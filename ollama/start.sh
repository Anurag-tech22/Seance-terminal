#!/bin/sh
# Serve Ollama, then pull Gemma (chat) and EmbeddingGemma (embeddings) onto the persistent disk.
ollama serve &
PID=$!
until ollama list >/dev/null 2>&1; do sleep 1; done
ollama pull "${GEN_MODEL:-gemma3:1b}"
ollama pull "${EMBED_MODEL:-embeddinggemma}"
wait $PID
