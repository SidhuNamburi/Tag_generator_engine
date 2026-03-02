# 1. Start with a clean Python 3.11 Linux environment
FROM python:3.11

# 2. Set the working directory inside the cloud server
WORKDIR /code

# 3. Copy your requirements and install them
COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# 4. Copy the rest of your code (engine.py, main.py, etc.)
COPY . /code

# 5. Start the FastAPI server on port 7860 (Hugging Face's default port)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]