EGE Russian 80+ — Local AI integration

Replace index.html and ai_bridge.js in the GitHub Pages repository with these files.
The AI tab is built directly into index.html, so it does not depend on dynamic injection to appear.

On the PC run your working local bridge:
http://127.0.0.1:8000

The bridge must expose:
GET /api/status
POST /api/chat

Qwen 3 8B is used through Ollama.

The AI output supports Markdown-like formatting: headings, bold, italic, lists, code and paragraphs.
