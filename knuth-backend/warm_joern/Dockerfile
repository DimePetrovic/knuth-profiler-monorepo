FROM python:3.11-slim

ARG JOERN_VERSION=v4.0.515
ENV DEBIAN_FRONTEND=noninteractive
ENV JOERN_HOME=/opt/joern/joern-cli
ENV PATH="${JOERN_HOME}:${PATH}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl unzip openjdk-21-jre-headless bash ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/joern
RUN curl -L "https://github.com/joernio/joern/releases/download/${JOERN_VERSION}/joern-cli.zip" -o joern-cli.zip \
    && unzip joern-cli.zip \
    && rm joern-cli.zip

WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY warm_joern ./warm_joern

CMD ["python", "-m", "uvicorn", "warm_joern.main:app", "--host", "0.0.0.0", "--port", "7070"]
