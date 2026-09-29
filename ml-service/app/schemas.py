from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class ReportIn(BaseModel):
    id: str
    text: str = Field(min_length=1, max_length=10000)
    language: Optional[str] = "en"


class ClassifyRequest(BaseModel):
    reports: List[ReportIn] = Field(max_length=256)


class TagIn(BaseModel):
    id: str
    text: str = Field(min_length=1, max_length=10000)


class TagRequest(BaseModel):
    reports: List[TagIn] = Field(max_length=256)


class ClusterIn(BaseModel):
    id: str
    text: Optional[str] = ""
    activity: Optional[str] = ""
    location: Optional[str] = ""
    barrierFailureType: Optional[str] = "none"
    rules: List[str] = []
    siteId: Optional[str] = ""


class ClusterRequest(BaseModel):
    reports: List[ClusterIn] = Field(max_length=5000)


class CorrectionIn(BaseModel):
    text: str = Field(min_length=1)
    classification: Literal["SIF", "NON_SIF"]
    rules: List[str] = []
    barrierFailureType: Optional[str] = "none"


class RetrainRequest(BaseModel):
    corrections: List[CorrectionIn] = []
