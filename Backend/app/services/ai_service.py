import random
import re
import os
from typing import List, Dict, Optional
import requests

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app import db
from app.models import Note, Question


class AIContentService:
    """Provides lightweight note retrieval and MCQ generation powered by scikit-learn."""

    _GREETING_PATTERN = re.compile(r"\b(hi|hello|hey|yo|good\s+morning|good\s+afternoon|good\s+evening)\b", re.IGNORECASE)
    _THANKS_PATTERN = re.compile(r"\b(thanks|thank\s+you|thx)\b", re.IGNORECASE)

    def __init__(self):
        self.hf_api_token = os.environ.get('HUGGINGFACE_API_KEY', '').strip()
        self.hf_model = os.environ.get('HUGGINGFACE_MODEL', 'google/flan-t5-large').strip()

    def _hf_generate_text(self, prompt: str, max_new_tokens: int = 120) -> Optional[str]:
        if not self.hf_api_token:
            return None

        url = f"https://api-inference.huggingface.co/models/{self.hf_model}"
        headers = {
            'Authorization': f'Bearer {self.hf_api_token}',
            'Content-Type': 'application/json',
        }
        payload = {
            'inputs': prompt,
            'parameters': {
                'max_new_tokens': max_new_tokens,
                'temperature': 0.4,
                'return_full_text': False,
            }
        }

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=8)
            if response.status_code != 200:
                return None
            body = response.json()
            if isinstance(body, list) and body and isinstance(body[0], dict):
                return (body[0].get('generated_text') or '').strip() or None
        except Exception:
            return None

        return None

    def _fallback_response(self, query: str) -> str:
        """Return friendly responses when note-grounded retrieval is unavailable."""
        normalized = (query or "").strip().lower()

        if not normalized:
            return (
                "I am ready to help. Ask me a topic question, or upload notes in Library "
                "so I can answer based on your own material."
            )

        if self._GREETING_PATTERN.search(normalized):
            return (
                "Hi! I am your AI tutor. I can help with study plans, quick concept checks, "
                "and note-based answers. Upload notes in Library for personalized responses."
            )

        if self._THANKS_PATTERN.search(normalized):
            return "You are welcome. Ask another question anytime."

        return (
            "I do not have your notes yet, so I cannot give a note-grounded answer. "
            "Upload notes in the Library section, then ask again for more accurate help."
        )

    def _sentences_from_text(self, text: str) -> List[str]:
        chunks = re.split(r"(?<=[.!?])\s+", text.strip())
        return [c.strip() for c in chunks if len(c.strip()) > 20]

    def _extract_top_terms(self, text: str, top_k: int = 30) -> List[str]:
        vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), max_features=500)
        try:
            vectorizer.fit([text])
        except ValueError:
            return []

        terms = list(vectorizer.get_feature_names_out())
        terms.sort(key=len, reverse=True)
        return terms[:top_k]

    def generate_mcqs_from_note(self, note: Note, count: int = 10) -> List[Question]:
        sentences = self._sentences_from_text(note.content)
        if len(sentences) < 4:
            return []

        random.shuffle(sentences)
        base_sentences = sentences[: max(count, 4)]
        terms = self._extract_top_terms(note.content)

        generated_questions: List[Question] = []

        for idx, sentence in enumerate(base_sentences[:count]):
            lower_sentence = sentence.lower()
            keyword = next((t for t in terms if t in lower_sentence), "this concept")

            distractor_pool = [s for s in sentences if s != sentence]
            random.shuffle(distractor_pool)
            distractors = distractor_pool[:3]

            if len(distractors) < 3:
                continue

            options = [sentence, distractors[0], distractors[1], distractors[2]]
            random.shuffle(options)
            correct_text = sentence
            correct_index = options.index(correct_text)
            correct_option = ["A", "B", "C", "D"][correct_index]

            q = Question(
                note_id=note.id,
                topic_id=None,
                question_text=f"Which statement is most accurate about '{keyword}' based on your notes?",
                option_a=options[0][:255],
                option_b=options[1][:255],
                option_c=options[2][:255],
                option_d=options[3][:255],
                correct_option=correct_option,
            )
            generated_questions.append(q)

        if not generated_questions:
            return []

        Question.query.filter_by(note_id=note.id).delete()
        for q in generated_questions:
            db.session.add(q)
        db.session.commit()
        return generated_questions

    def answer_from_notes(self, query: str, note_id: Optional[int] = None, user_id: Optional[int] = None) -> str:
        fallback = self._fallback_response(query)

        notes_query = Note.query

        if note_id is not None:
            notes_query = notes_query.filter_by(id=note_id)
        elif user_id is not None:
            notes_query = notes_query.filter_by(user_id=user_id)

        notes = notes_query.order_by(Note.created_at.desc()).limit(10).all()
        if not notes:
            return fallback

        corpus_sentences: List[str] = []
        for n in notes:
            corpus_sentences.extend(self._sentences_from_text(n.content))

        if not corpus_sentences:
            return "Your notes were found, but usable sentence content is limited. Please upload richer note text."

        vectorizer = TfidfVectorizer(stop_words="english")
        matrix = vectorizer.fit_transform(corpus_sentences + [query])

        query_vec = matrix[-1]
        note_vecs = matrix[:-1]

        sims = cosine_similarity(query_vec, note_vecs).flatten()
        top_idx = sims.argsort()[::-1][:3]

        best_sentences = [corpus_sentences[i] for i in top_idx if sims[i] > 0]
        if not best_sentences:
            return (
                "I could not find a strong match in your uploaded notes. "
                "Try asking with clearer topic keywords or upload more detailed notes."
            )

        return " ".join(best_sentences)

    def evaluate_answers(self, questions: List[Question], answers: Dict[int, str]) -> Dict[str, object]:
        total = len(questions)
        if total == 0:
            return {"total": 0, "correct": 0, "score": 0.0, "details": []}

        details = []
        correct = 0

        for q in questions:
            selected = (answers.get(q.id) or "").upper()
            is_correct = selected == q.correct_option.upper()
            if is_correct:
                correct += 1

            details.append(
                {
                    "question_id": q.id,
                    "selected_option": selected,
                    "correct_option": q.correct_option,
                    "is_correct": is_correct,
                }
            )

        score = correct / total
        return {"total": total, "correct": correct, "score": score, "details": details}

    def build_feedback_and_hint(self, question: Question, selected_option: str) -> Dict[str, str]:
        """Creates lightweight AI-style feedback and hint text for second-chance flow."""
        selected_option = (selected_option or "").upper()
        options = {
            "A": question.option_a,
            "B": question.option_b,
            "C": question.option_c,
            "D": question.option_d,
        }

        selected_text = options.get(selected_option, "an invalid option")
        correct_text = options.get(question.correct_option.upper(), "the correct option")

        # Use TF-IDF similarity between question and options to craft a contextual hint.
        vectorizer = TfidfVectorizer(stop_words="english")
        corpus = [question.question_text, question.option_a, question.option_b, question.option_c, question.option_d]

        try:
            mat = vectorizer.fit_transform(corpus)
            question_vec = mat[0]
            option_vecs = mat[1:]
            sims = cosine_similarity(question_vec, option_vecs).flatten()
            ranked = sims.argsort()[::-1]
            likely_option = ["A", "B", "C", "D"][ranked[0]]
        except ValueError:
            likely_option = question.correct_option.upper()

        feedback = (
            f"That choice is not correct. You selected option {selected_option}: '{selected_text}'. "
            "Focus on the key concept asked in the question before re-checking options."
        )

        if likely_option == question.correct_option.upper():
            hint = "Hint: look for the option that directly matches the main concept in the question wording."
        else:
            hint = (
                f"Hint: compare options {likely_option} and {question.correct_option.upper()} carefully. "
                "The best answer is the one that is most specific to the asked concept."
            )

        reveal = f"If still unsure, eliminate distractors that are broad or unrelated."

        hf_prompt = (
            f"Question: {question.question_text}\n"
            f"Selected option ({selected_option}): {selected_text}\n"
            f"Correct option ({question.correct_option.upper()}): {correct_text}\n"
            "Write 2 concise lines: first explain why selected option is wrong, then give one hint to find the correct answer."
        )
        ai_explain = self._hf_generate_text(hf_prompt, max_new_tokens=90)
        if ai_explain:
            lines = [ln.strip() for ln in ai_explain.split('\n') if ln.strip()]
            if lines:
                feedback = lines[0]
            if len(lines) > 1:
                hint = lines[1]

        return {
            "feedback": feedback,
            "hint": f"{hint} {reveal}",
            "correct_option": question.correct_option.upper(),
            "correct_text": correct_text,
        }
