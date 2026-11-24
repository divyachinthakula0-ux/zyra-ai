
import sqlite3
from pathlib import Path

# Database file location
DATABASE_NAME = Path(__file__).with_name("zyra.db")


# ==========================================
# 1. DATABASE CONNECTION
# ==========================================

def get_connection():

    connection = sqlite3.connect(DATABASE_NAME)
    connection.row_factory = sqlite3.Row

    return connection


# ==========================================
# 2. CREATE DATABASE TABLES
# ==========================================

def create_tables():

    connection = get_connection()
    cursor = connection.cursor()

    # Conversation history
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_message TEXT NOT NULL,
            assistant_reply TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Task history
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS task_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            command TEXT NOT NULL,
            action TEXT NOT NULL,
            status TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Long-term personal memory
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            memory_key TEXT NOT NULL UNIQUE,
            memory_value TEXT NOT NULL,
            category TEXT DEFAULT 'general',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Reminders
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reminders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reminder_text TEXT NOT NULL,
            reminder_datetime DATETIME NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    connection.commit()
    connection.close()

    print("ZYRA AI database tables created successfully!")


# ==========================================
# 3. SAVE CONVERSATION
# ==========================================

def save_conversation(user_message, assistant_reply):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        INSERT INTO conversations (user_message, assistant_reply)
        VALUES (?, ?)
    """, (user_message, assistant_reply))

    connection.commit()
    connection.close()

# ==========================================
# SAVE TASK HISTORY
# ==========================================

def save_task(command, action, status):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        INSERT INTO task_history (
            command,
            action,
            status
        )
        VALUES (?, ?, ?)
    """, (
        command,
        action,
        status
    ))

    connection.commit()
    connection.close()


# ==========================================
# GET TASK HISTORY
# ==========================================

def get_task_history():

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            id,
            command,
            action,
            status,
            timestamp
        FROM task_history
        ORDER BY id DESC
    """)

    tasks = [
        dict(row) for row in cursor.fetchall()
    ]

    connection.close()

    return tasks



# ==========================================
# 4. GET CONVERSATIONS
# ==========================================

def get_conversations():

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT id, user_message, assistant_reply, timestamp
        FROM conversations
        ORDER BY id ASC
    """)

    conversations = [
        dict(row) for row in cursor.fetchall()
    ]

    connection.close()

    return conversations


# ==========================================
# 5. CLEAR CONVERSATIONS
# ==========================================

def clear_conversations():

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("DELETE FROM conversations")

    connection.commit()
    connection.close()


# ==========================================
# 6. SAVE LONG-TERM MEMORY
# ==========================================

def save_memory(memory_key, memory_value, category="general"):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        INSERT INTO memories (
            memory_key,
            memory_value,
            category
        )
        VALUES (?, ?, ?)

        ON CONFLICT(memory_key)
        DO UPDATE SET
            memory_value = excluded.memory_value,
            category = excluded.category,
            updated_at = CURRENT_TIMESTAMP
    """, (
        memory_key.strip().lower(),
        memory_value.strip(),
        category.strip().lower()
    ))

    connection.commit()
    connection.close()


# ==========================================
# 7. GET ALL LONG-TERM MEMORIES
# ==========================================

def get_memories():

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            id,
            memory_key,
            memory_value,
            category,
            created_at,
            updated_at
        FROM memories
        ORDER BY id ASC
    """)

    memories = [
        dict(row) for row in cursor.fetchall()
    ]

    connection.close()

    return memories


# ==========================================
# 8. FIND MEMORY USING ITS KEY
# ==========================================

def get_memory_by_key(memory_key):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT *
        FROM memories
        WHERE memory_key = ?
    """, (memory_key.strip().lower(),))

    row = cursor.fetchone()

    memory = dict(row) if row else None

    connection.close()

    return memory


# ==========================================
# 9. DELETE ONE MEMORY USING ITS ID
# ==========================================

def delete_memory(memory_id):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        "DELETE FROM memories WHERE id = ?",
        (memory_id,)
    )

    deleted = cursor.rowcount > 0

    connection.commit()
    connection.close()

    return deleted


# ==========================================
# 10. DELETE ONE MEMORY USING ITS KEY
# ==========================================

def delete_memory_by_key(memory_key):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        DELETE FROM memories
        WHERE memory_key = ?
    """, (memory_key.strip().lower(),))

    deleted = cursor.rowcount > 0

    connection.commit()
    connection.close()

    return deleted


# ==========================================
# 11. DELETE MEMORIES BY CATEGORY
# ==========================================

def delete_memories_by_category(category):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        DELETE FROM memories
        WHERE category = ?
    """, (category.strip().lower(),))

    deleted_count = cursor.rowcount

    connection.commit()
    connection.close()

    return deleted_count


# ==========================================
# 12. CLEAR ALL LONG-TERM MEMORIES
# ==========================================

def clear_memories():

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("DELETE FROM memories")

    deleted_count = cursor.rowcount

    connection.commit()
    connection.close()

    return deleted_count


# ==========================================
# 13. CREATE A REMINDER
# ==========================================

def create_reminder(reminder_text, reminder_datetime):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        INSERT INTO reminders (
            reminder_text,
            reminder_datetime
        )
        VALUES (?, ?)
    """, (
        reminder_text.strip(),
        reminder_datetime
    ))

    reminder_id = cursor.lastrowid

    connection.commit()
    connection.close()

    return reminder_id


# ==========================================
# 14. GET ALL REMINDERS
# ==========================================

def get_reminders():

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            id,
            reminder_text,
            reminder_datetime,
            status,
            created_at
        FROM reminders
        ORDER BY reminder_datetime ASC
    """)

    reminders = [
        dict(row) for row in cursor.fetchall()
    ]

    connection.close()

    return reminders


# ==========================================
# 15. GET PENDING REMINDERS
# ==========================================

def get_pending_reminders():

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            id,
            reminder_text,
            reminder_datetime,
            status,
            created_at
        FROM reminders
        WHERE status = 'pending'
        ORDER BY reminder_datetime ASC
    """)

    reminders = [
        dict(row) for row in cursor.fetchall()
    ]

    connection.close()

    return reminders


# ==========================================
# 16. GET DUE REMINDERS
# ==========================================

def get_due_reminders():

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            id,
            reminder_text,
            reminder_datetime,
            status
        FROM reminders
        WHERE status = 'pending'
        AND reminder_datetime <= datetime('now', 'localtime')
        ORDER BY reminder_datetime ASC
    """)

    reminders = [
        dict(row) for row in cursor.fetchall()
    ]

    connection.close()

    return reminders


# ==========================================
# 17. MARK REMINDER AS COMPLETED
# ==========================================

def complete_reminder(reminder_id):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        UPDATE reminders
        SET status = 'completed'
        WHERE id = ?
        AND status = 'pending'
    """, (reminder_id,))

    updated = cursor.rowcount > 0

    connection.commit()
    connection.close()

    return updated


# ==========================================
# 18. DELETE A REMINDER
# ==========================================

def delete_reminder(reminder_id):

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        DELETE FROM reminders
        WHERE id = ?
    """, (reminder_id,))

    deleted = cursor.rowcount > 0

    connection.commit()
    connection.close()

    return deleted


# ==========================================
# 19. TEST DATABASE
# ==========================================

if __name__ == "__main__":

    create_tables()

    print("Saved conversations:", len(get_conversations()))
    print("Saved memories:", len(get_memories()))
    print("Saved reminders:", len(get_reminders()))
