FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN pip install --no-cache-dir --timeout 180 -i https://pypi.tuna.tsinghua.edu.cn/simple \
    "django>=6.0,<7.0" \
    "djangorestframework>=3.17,<4.0" \
    "django-cors-headers>=4.9,<5.0" \
    "python-dotenv>=1.2,<2.0" \
    "psycopg[binary]>=3.3,<4.0" \
    "gunicorn>=23,<24"

COPY . .

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2"]
