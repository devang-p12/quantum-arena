import io
import PyPDF2

def extract_text_from_file(file_content: bytes, filename: str) -> str:
    """Extracts text from an uploaded file based on its extension."""
    if filename.lower().endswith(".pdf"):
        return _extract_from_pdf(file_content)
    elif filename.lower().endswith(".txt"):
        return file_content.decode("utf-8", errors="replace")
    else:
        # Fallback to UTF-8 decoding for unknown generic text types
        return file_content.decode("utf-8", errors="ignore")

def _extract_from_pdf(file_content: bytes) -> str:
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        text = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text.append(t)
        return "\n".join(text)
    except Exception as e:
        return f"Error extracting PDF: {str(e)}"
