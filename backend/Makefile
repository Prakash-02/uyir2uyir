.PHONY: dev test lint format

dev:
	uvicorn app.main:app --reload --port 8080

test:
	pytest

lint:
	ruff check .
	ruff format --check .

format:
	ruff format .
	ruff check --fix .
