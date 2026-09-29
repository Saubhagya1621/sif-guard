"""Contract tests. Trains a fresh model into temp dirs (~30 s)."""
import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client(tmp_path_factory):
    os.environ["MODELS_DIR"] = str(tmp_path_factory.mktemp("models"))
    os.environ["DATA_DIR"] = str(tmp_path_factory.mktemp("data"))
    os.environ["USE_SENTENCE_TRANSFORMERS"] = "0"
    os.environ["USE_TRANSFORMER"] = "0"
    from app.main import app  # imported after env is set
    with TestClient(app) as c:
        yield c


RULE_KEYS = {"bypassing_safety_controls", "confined_space", "driving", "energy_isolation", "hot_work",
             "line_of_fire", "safe_mechanical_lifting", "work_authorisation", "working_at_height"}


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_classify_shapes_and_offsets(client):
    reports = [
        {"id": "R-1", "text": "Rigger standing under the suspended load during crane lift of casing joints.", "language": "en"},
        {"id": "R-2", "text": "Worker slipped on a wet floor in the canteen, no injury.", "language": "en"},
    ]
    res = client.post("/classify", json={"reports": reports}).json()["results"]
    by_id = {r["id"]: r for r in res}
    assert by_id["R-1"]["classification"] == "SIF"
    assert by_id["R-2"]["classification"] == "NON_SIF"
    for r, src in zip(res, reports):
        assert 0 <= r["sifProbability"] <= 1 and 0 <= r["confidence"] <= 1
        assert r["potentialSeverity"] in {"fatal", "serious", "minor"}
        assert r["barrierFailureType"] in {"ppe", "procedure", "isolation", "supervision", "equipment", "training", "none"}
        for p in r["highlightedPhrases"]:
            assert src["text"][p["start"]:p["end"]] == p["text"]
    assert by_id["R-1"]["highlightedPhrases"], "SIF report should have highlighted phrases"


def test_hindi_returns_no_offsets(client):
    res = client.post("/classify", json={"reports": [
        {"id": "H-1", "text": "पंप की मरम्मत के दौरान लॉकआउट नहीं किया गया था और मोटर चालू थी।", "language": "hi"}]}).json()
    assert res["results"][0]["highlightedPhrases"] == []


def test_tag_rules(client):
    res = client.post("/tag-rules", json={"reports": [
        {"id": "R-3", "text": "Welding started near the separator without hot work permit and no gas test."}]}).json()
    rules = res["results"][0]["lifeSavingRules"]
    assert 1 <= len(rules) <= 3
    assert rules[0]["rule"] == "hot_work"
    assert all(r["confidence"] >= 0.4 and r["rule"] in RULE_KEYS for r in rules)
    assert [r["confidence"] for r in rules] == sorted((r["confidence"] for r in rules), reverse=True)


def test_cluster(client):
    assert client.post("/cluster", json={"reports": [{"id": "a", "text": "x"}]}).json() == {"clusters": []}
    reports = []
    for i in range(6):
        reports.append({"id": f"L{i}", "text": f"Rigger {i} walked under suspended load during crane lift", "activity": "Crane lift",
                        "location": "Rig DJN-12", "barrierFailureType": "supervision", "rules": ["safe_mechanical_lifting"], "siteId": "duliajan"})
        reports.append({"id": f"P{i}", "text": f"Fitter {i} opened pump without lockout, motor energised", "activity": "Pump maintenance",
                        "location": "Well pad 3", "barrierFailureType": "isolation", "rules": ["energy_isolation"], "siteId": "moran"})
    clusters = client.post("/cluster", json={"reports": reports}).json()["clusters"]
    assert clusters
    keys = {"id", "label", "activity", "location", "barrierFailureType", "rule", "count", "siteIds", "reportIds"}
    assert all(keys <= set(c) for c in clusters)


def test_retrain_bumps_version(client):
    before = client.get("/metrics").json()["modelVersion"]
    res = client.post("/retrain", json={"corrections": [
        {"text": "Helper cleaned the drain pit without gas test", "classification": "SIF", "rules": ["confined_space"], "barrierFailureType": "procedure"}]}).json()
    assert res["status"] == "completed" and res["trainedOn"] == 1
    after = client.get("/metrics").json()
    assert after["modelVersion"] == res["modelVersion"] != before
    for k in ("accuracy", "precision", "recall", "f1", "lastTrainedAt", "trainingSamples"):
        assert k in after


def test_validation_error_format(client):
    r = client.post("/classify", json={"reports": [{"id": "x"}]})
    assert r.status_code == 400 and r.json()["error"]["code"] == "VALIDATION_ERROR"
