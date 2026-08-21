# Backend Core TDD Evidence

Source: journeys derived from the Sabaqtas backend-core request.

| Guarantee | Test | Evidence |
| --- | --- | --- |
| A wrong diagnostic answer advances only to an owned prerequisite question and never exposes its answer key. | `tests/unit/test_diagnostics.py::test_wrong_answer_moves_to_prerequisite_without_exposing_correct_answer` | RED: import failed before `app` existed; GREEN: pytest passes. |
| A correct answer completes the diagnostic with no root gap. | `tests/unit/test_diagnostics.py::test_correct_answer_finishes_without_root_gap` | GREEN: pytest passes. |
| A duplicate answer cannot advance state twice. | `tests/unit/test_diagnostics.py::test_replaying_an_answer_is_rejected_after_current_question_changes` | GREEN: pytest passes. |
| Core service rules compute remediation, mastery, teacher authorization and RAG thresholding. | `tests/unit/test_services.py` | GREEN: pytest passes. |
| The application publishes a health endpoint. | `tests/api/test_health.py` | GREEN: pytest passes. |

Coverage command: `python -m pytest --cov --cov-report=term-missing -q`. The measured application-service layer has an 80% threshold. PostgreSQL mappings and Gemini network calls are intentionally excluded from this unit-test target; they require a configured PostgreSQL test database and mocked SDK integration tests.
