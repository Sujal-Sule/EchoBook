"use client";

import { useEffect, useState } from 'react';

type Book = {
    id: string;
    storyteller_name: string;
    last_updated: string;
    last_session_summary: string;
};

export default function DashboardScreen({
    userId,
    backendUrl,
    onLogout,
    onContinueSession
}: {
    userId: string;
    backendUrl: string;
    onLogout: () => void;
    onContinueSession: (bookId: string, name: string) => void;
}) {
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [newName, setNewName] = useState("");

    useEffect(() => {
        async function fetchBooks() {
            try {
                const res = await fetch(`${backendUrl}/api/books/${userId}`);
                const data = await res.json();
                if (data.books) {
                    setBooks(data.books);
                }
            } catch (e: any) {
                setError("Error loading books. Backend might be down.");
            } finally {
                setLoading(false);
            }
        }
        fetchBooks();
    }, [userId, backendUrl]);

    const handleCreateNewBook = async () => {
        if (!newName.trim()) return;
        const newBookId = 'book_' + Date.now();
        try {
            await fetch(`${backendUrl}/api/books`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, book_id: newBookId, storyteller_name: newName.trim() })
            });
        } catch (e) {
            console.error(e);
        }
        setShowModal(false);
        onContinueSession(newBookId, newName.trim());
    };

    return (
        <>
            <div id="dashboard-screen">
                <div className="dashboard-header">
                    <h1>Your Library</h1>
                    <button className="btn-signout" onClick={onLogout}>
                        Sign Out
                    </button>
                </div>

                {loading ? (
                    <span style={{ color: 'var(--ink-soft)' }}>Loading books...</span>
                ) : error ? (
                    <span style={{ color: 'var(--error)' }}>{error}</span>
                ) : (
                    <div className="books-grid">
                        <div className="book-card new-book-card" onClick={() => setShowModal(true)}>
                            <div className="plus-icon">+</div>
                            <h3>New Book</h3>
                        </div>

                        {books.map((book) => {
                            const dateStr = new Date(book.last_updated).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                            return (
                                <div key={book.id} className="book-card" onClick={() => onContinueSession(book.id, book.storyteller_name || 'Storyteller')}>
                                    <div>
                                        <div className="book-card-title">{book.storyteller_name || 'Storyteller'}'s Book</div>
                                        <div className="book-card-date">Last updated: {dateStr}</div>
                                        <div className="book-card-summary">{book.last_session_summary || ''}</div>
                                    </div>
                                    <div className="book-card-action">
                                        Continue <span style={{ fontFamily: 'sans-serif' }}>→</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className={`modal-overlay ${showModal ? 'active' : ''}`} id="new-book-modal">
                <div className="modal-box">
                    <h2>Start a New Book</h2>
                    <p>Whose memories are we preserving?</p>
                    <input
                        type="text"
                        className="modal-input"
                        placeholder="Storyteller's Name (e.g., Eleanor)"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateNewBook() }}
                        autoFocus={showModal}
                    />
                    <div className="modal-actions">
                        <button className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                        <button className="btn-primary" onClick={handleCreateNewBook}>Begin Interview</button>
                    </div>
                </div>
            </div>
        </>
    );
}
