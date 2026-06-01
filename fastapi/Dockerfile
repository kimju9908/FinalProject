FROM python:3.11

# 작업 디렉토리 설정
WORKDIR /app

# 필요한 파일 복사
COPY requirements.txt /app/

# 의존성 설치
RUN pip install --no-cache-dir -r requirements.txt

# 나머지 파일 복사
COPY . /app/

# FastAPI 앱 실행 (uvicorn)
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5000"]
