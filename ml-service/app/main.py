"""SIF-Guard ML service: contract §3. Called only by the Node backend (never by the browser)."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .model import Predictor
from .schemas import ClassifyRequest, ClusterRequest, RetrainRequest, TagRequest

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("sifguard.ml")
state = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    predictor = Predictor()  # loads (or trains on first run) once at startup
    predictor.warmup()
    state["p"] = predictor
    yield


app = FastAPI(title="SIF-Guard ML service", version="1.0.0", lifespan=lifespan)


def P() -> Predictor:
    return state["p"]


def _error(status, code, message):
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    msg = "; ".join(f"{'.'.join(str(x) for x in e['loc'][1:])}: {e['msg']}" for e in exc.errors())
    return _error(400, "VALIDATION_ERROR", msg or "Invalid request")


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception):
    log.exception("Unhandled error on %s", request.url.path)
    return _error(500, "SERVER_ERROR", "ML service error")


@app.get("/health")
def health():
    return {"status": "ok", "modelVersion": P().model_version}


@app.post("/classify")
def classify(req: ClassifyRequest):
    return {"results": P().classify(req.reports)}


@app.post("/tag-rules")
def tag_rules(req: TagRequest):
    tags = P().tag_rules(req.reports)
    return {"results": [{"id": r.id, "lifeSavingRules": t} for r, t in zip(req.reports, tags)]}


@app.post("/cluster")
def cluster(req: ClusterRequest):
    return {"clusters": P().cluster(req.reports)}


@app.post("/retrain")
def retrain(req: RetrainRequest):
    return P().retrain([c.model_dump() for c in req.corrections])


@app.get("/metrics")
def metrics():
    return P().metrics_payload()
