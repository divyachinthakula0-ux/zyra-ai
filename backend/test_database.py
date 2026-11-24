from database import create_tables, save_conversation, get_conversations

create_tables()

save_conversation(
    "Hello ZYRA",
    "Hello! How can I help you?"
)

history = get_conversations()

for item in history:
    print(dict(item))