"""
Tag & Trail Categorization Engine
Core NLP pipeline to extract, score, and diversify tags from web documents.
"""

import spacy
import re
import math
import sqlite3
import numpy as np
from datetime import datetime, timedelta
from collections import Counter
from sentence_transformers import SentenceTransformer, util
from sklearn.metrics.pairwise import cosine_similarity

# --- Configuration & Models ---
nlp = spacy.load("en_core_web_sm", disable=["ner"])
embedder = SentenceTransformer('all-mpnet-base-v2')

DB_PATH = "tag_trail_memory.db"

MIN_BLOCKLIST = {
    "introduction", "abstract", "summary", "conclusion", "discussion",
    "results", "method", "methods", "analysis", "evaluation", "experiment",
    "section", "chapter", "appendix", "figure", "table", "equation",
    "reference", "paper", "study", "article", "report", "overview",
    "background", "related", "work", "step", "procedure", "process",
    "read", "more", "cookie", "cookies", "newsletter", "subscribe",
    "password", "login", "policy", "privacy"
}

TECH_PATTERNS = [
    r'\b[A-Za-z0-9]+\.js\b',      # Node.js, React.js
    r'\b[A-Za-z]+[\+#]{1,2}\b',   # C++, C#
    r'(?i)(?<!\S)\.net\b'         # .NET
]


# --- Database & Memory Operations ---
def init_db():
    """Initializes the SQLite database with a timestamp for smart pruning."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tag_freq (
            phrase TEXT PRIMARY KEY, 
            frequency INTEGER DEFAULT 0,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def prune_database(days_old=30):
    """Deletes tags that haven't been seen recently so the AI can forget old habits."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cutoff_date = datetime.now() - timedelta(days=days_old)
    cursor.execute("DELETE FROM tag_freq WHERE last_seen < ?", (cutoff_date,))
    conn.commit()
    conn.close()

def get_df_counts(candidate_list):
    """Retrieves the frequency counts of candidate tags to calculate rareness penalties."""
    if not candidate_list: 
        return {}
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    placeholders = ','.join(['?'] * len(candidate_list))
    cursor.execute(f"SELECT phrase, frequency FROM tag_freq WHERE phrase IN ({placeholders})", candidate_list)
    results = dict(cursor.fetchall())
    conn.close()
    return {phrase: results.get(phrase, 0) for phrase in candidate_list}

def update_df_counts(winning_tags):
    """Updates the frequency and 'last_seen' timestamp of the final selected tags."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    for tag in winning_tags:
        cursor.execute('''
            INSERT INTO tag_freq (phrase, frequency, last_seen) 
            VALUES (?, 1, CURRENT_TIMESTAMP) 
            ON CONFLICT(phrase) 
            DO UPDATE SET 
                frequency = frequency + 1,
                last_seen = CURRENT_TIMESTAMP
        ''', (tag,))
    conn.commit()
    conn.close()


# --- Text Extraction & Cleaning ---
def dynamic_tech_shield(text):
    """Protects technical frameworks with punctuation (e.g., Node.js) from being split by SpaCy."""
    document_tech_map = {}
    token_counter = 0
    text = re.sub(r'\n\n+', '.\n\n', text)

    for pattern in TECH_PATTERNS:
        matches = set(re.findall(pattern, text))
        for match in matches:
            placeholder = f"techtoken{token_counter}xyz"
            document_tech_map[placeholder] = match
            text = text.replace(match, placeholder)
            token_counter += 1
    return text, document_tech_map

def clean_and_truncate_chunk(chunk):
    """Cleans a SpaCy noun chunk, stripping brackets, symbols, and checking blocklists."""
    start_idx = 0
    for i, token in enumerate(chunk):
        if token.pos_ in {"DET", "PRON", "PART"}: start_idx = i + 1
        else: break
    if start_idx >= len(chunk): return None
    span = chunk[start_idx:]

    end_idx = len(span)
    for i, token in enumerate(span):
        if token.pos_ == "VERB" and token.tag_ not in {"VBG", "VBN"}:
            end_idx = i; break
        if token.pos_ in {"SCONJ"}:
            end_idx = i; break
    span = span[:end_idx]

    clean_words = []
    for token in span:
        if token.is_punct or token.is_bracket or token.pos_ in {"PUNCT", "SYM", "SPACE"}:
            continue
        safe_word = re.sub(r'[^a-z0-9]', '', token.text.lower())
        if safe_word:
            clean_words.append(safe_word)

    if len(clean_words) > 4 or len(clean_words) == 0: return None
    if any(word in MIN_BLOCKLIST for word in clean_words): return None

    text = " ".join(clean_words)
    if text.isdigit() or (sum(c.isdigit() for c in text) / max(len(text), 1) > 0.5): return None

    return text

def get_candidate_pool(raw_text):
    """Extracts all valid noun chunks and single words to form the candidate pool."""
    text, tech_map = dynamic_tech_shield(raw_text)
    doc = nlp(text)
    candidate_counter = Counter()
    chunks_found = False

    for chunk in doc.noun_chunks:
        cleaned_text = clean_and_truncate_chunk(chunk)
        if cleaned_text:
            chunks_found = True
            words = cleaned_text.split()
            for n in range(1, min(5, len(words) + 1)):
                for i in range(len(words) - n + 1):
                    ngram = " ".join(words[i:i+n])
                    if n == 1 and (len(ngram) < 3 or nlp(ngram)[0].pos_ in {"ADJ", "VERB"}): continue
                    if ngram not in MIN_BLOCKLIST: candidate_counter[ngram] += 1

    if not chunks_found or len(text.split()) <= 5:
        for token in doc:
            if token.pos_ in {"NOUN", "PROPN"} and token.text.lower() not in MIN_BLOCKLIST:
                if not token.is_punct and not token.is_space: candidate_counter[token.text.lower()] += 1

    final_pool = Counter()
    for phrase, count in candidate_counter.items():
        for placeholder, real_word in tech_map.items():
            if placeholder in phrase: phrase = phrase.replace(placeholder, real_word)
        final_pool[phrase] = count
    return final_pool


# --- Scoring & Diversification ---
def score_candidates(candidate_pool, doc_text, title_text=""):
    """Scores candidate phrases against the document embedding, applying custom Tag & Trail rules."""
    candidates = list(candidate_pool.keys())
    if not candidates: return []

    doc_emb = embedder.encode(doc_text, convert_to_tensor=True)
    cand_embs = embedder.encode(candidates, convert_to_tensor=True)
    sim_scores = util.cos_sim(doc_emb, cand_embs)[0].cpu().numpy()

    df_counts = get_df_counts(candidates)
    scored_candidates = []
    title_lower = title_text.lower()

    for i, cand in enumerate(candidates):
        word_count = len(cand.split())
        
        year_penalty = 0.5 if re.search(r'\b(20\d{2})\b', cand) else 0.0
        phrase_bonus = 0.2 if word_count >= 2 else 0.0
        title_bonus = 0.35 if cand in title_lower else 0.0
        rareness_penalty = 0.1 * math.log10(df_counts.get(cand, 0) + 1)
        length_penalty = (word_count - 3) * 0.1 if word_count > 3 else 0.0

        final_score = sim_scores[i] + phrase_bonus + title_bonus - length_penalty - year_penalty - rareness_penalty
        scored_candidates.append({'phrase': cand, 'score': final_score, 'embedding': cand_embs[i]})

    return sorted(scored_candidates, key=lambda x: x['score'], reverse=True)

def apply_mmr(scored_candidates, top_n=4, diversity=0.45):
    """Applies Maximal Marginal Relevance to ensure final tags are conceptually diverse."""
    if not scored_candidates: return []
    top_candidates = scored_candidates[:30]
    selected_tags, selected_embeddings = [], []

    first = top_candidates.pop(0)
    selected_tags.append(first['phrase'])
    selected_embeddings.append(first['embedding'].cpu().numpy())

    while len(selected_tags) < top_n and len(top_candidates) > 0:
        best_mmr, best_idx = -100.0, -1
        for i, cand in enumerate(top_candidates):
            cand_phrase = cand['phrase']

            if any(cand_phrase in sel or sel in cand_phrase for sel in selected_tags):
                continue 

            cand_emb = cand['embedding'].cpu().numpy().reshape(1, -1)
            max_sim = np.max(cosine_similarity(cand_emb, selected_embeddings))

            cand_words = set(cand_phrase.split())
            overlap_penalty = 1.5 if any(len(cand_words.intersection(set(sel.split()))) > 0 for sel in selected_tags) else 0.0

            mmr_score = (cand['score'] * (1 - diversity)) - (max_sim * diversity) - overlap_penalty
            if mmr_score > best_mmr: 
                best_mmr, best_idx = mmr_score, i

        if best_idx == -1: break 

        winner = top_candidates.pop(best_idx)
        selected_tags.append(winner['phrase'])
        selected_embeddings.append(winner['embedding'].cpu().numpy())

    return selected_tags


# --- Main Wrapper Execution ---
def generate_tags(title, text):
    """Main function to process a document and return the final list of tags."""
    init_db()
    prune_database(days_old=30) # Clean up old memory before generating new tags
    
    combined_text = f"{title}. {text}"
    pool = get_candidate_pool(combined_text)

    for word in title.lower().split():
        clean_word = re.sub(r'[^\w\s]', '', word)
        if len(clean_word) > 3 and not nlp.vocab[clean_word].is_stop and clean_word not in MIN_BLOCKLIST:
            pool[clean_word] += 1

    scored = score_candidates(pool, combined_text, title_text=title)
    final_tags = apply_mmr(scored, top_n=4)
    update_df_counts(final_tags)
    
    return final_tags


if __name__ == "__main__":
    # Standard testing block. Runs only if you execute this file directly.
    sample_title = "The Ultimate 2026 Guide to Building Agentic AI and RAG Pipelines"
    sample_text = "Traditional databases are struggling. Vector databases like Pinecone are the new standard for Large Language Models."
    
    tags = generate_tags(sample_title, sample_text)
    print("Generated Tags:", tags)