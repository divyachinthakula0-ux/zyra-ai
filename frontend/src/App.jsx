
import { useEffect, useRef, useState } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";

function App() {
  const [backendStatus, setBackendStatus] = useState("Connecting...");
  const [activeSection, setActiveSection] = useState("dashboard");

  const [command, setCommand] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Voice preference is saved across browser refreshes.
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    return localStorage.getItem("zyra_voice_enabled") !== "false";
  });

  const [notificationPermission, setNotificationPermission] =
    useState(
      "Notification" in window
        ? Notification.permission
        : "unsupported"
    );

  const notificationCheckRef = useRef(false);

  // Task History
  const [taskHistory, setTaskHistory] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [taskHistoryError, setTaskHistoryError] = useState("");

  // Memory Management
  const [memories, setMemories] = useState([]);
  const [memoryKey, setMemoryKey] = useState("");
  const [memoryValue, setMemoryValue] = useState("");
  const [memoryCategory, setMemoryCategory] = useState("general");
  const [memoryStatus, setMemoryStatus] = useState("");
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);
  const [isSavingMemory, setIsSavingMemory] = useState(false);

  const recognitionRef = useRef(null);
  const chatPanelRef = useRef(null);

  // ==========================================
  // NAVIGATION
  // ==========================================

  const navigateTo = (sectionId) => {
    setActiveSection(sectionId);

    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  // ==========================================
  // 1. CHECK BACKEND CONNECTION
  // ==========================================

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch(`${API}/health`);

        if (!response.ok) {
          throw new Error("Backend connection failed");
        }

        const data = await response.json();

        setBackendStatus(
          data.status === "online"
            ? "System Online"
            : "System Offline"
        );
      } catch {
        setBackendStatus("Backend Offline");
      }
    };

    checkBackend();

    const interval = setInterval(checkBackend, 10000);

    return () => clearInterval(interval);
  }, []);

  // ==========================================
  // 2. LOAD CONVERSATION HISTORY
  // ==========================================

  useEffect(() => {
    const loadConversations = async () => {
      try {
        const response = await fetch(`${API}/conversations`);

        if (!response.ok) {
          throw new Error("Could not load conversation history.");
        }

        const data = await response.json();

        const savedMessages = (data.conversations || []).flatMap(
          (item) => {
            const date = new Date(
              item.timestamp.replace(" ", "T") + "Z"
            );

            const time = Number.isNaN(date.getTime())
              ? item.timestamp
              : date.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

            return [
              {
                id: `${item.id}-user`,
                sender: "user",
                text: item.user_message,
                time,
              },
              {
                id: `${item.id}-assistant`,
                sender: "assistant",
                text: item.assistant_reply,
                time,
              },
            ];
          }
        );

        setMessages(savedMessages);
      } catch (error) {
        console.error("History loading error:", error);
        setMessage("Could not load previous conversations.");
      }
    };

    loadConversations();
  }, []);

  // ==========================================
  // LOAD TASK HISTORY
  // ==========================================

  const loadTaskHistory = async () => {
    setIsLoadingTasks(true);
    setTaskHistoryError("");

    try {
      const response = await fetch(`${API}/task-history`);

      if (!response.ok) {
        throw new Error("Could not load task history.");
      }

      const data = await response.json();

      setTaskHistory(
        Array.isArray(data.tasks) ? data.tasks : []
      );
    } catch (error) {
      console.error("Task history loading error:", error);
      setTaskHistoryError(error.message);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  useEffect(() => {
    loadTaskHistory();
  }, []);

  // ==========================================
  // 3. LOAD MEMORIES
  // ==========================================

  const loadMemories = async () => {
    setIsLoadingMemories(true);

    try {
      const response = await fetch(`${API}/memories`);

      if (!response.ok) {
        throw new Error("Could not load saved memories.");
      }

      const data = await response.json();

      setMemories(
        Array.isArray(data.memories) ? data.memories : []
      );

      setMemoryStatus("");
    } catch (error) {
      console.error("Memory loading error:", error);
      setMemoryStatus(error.message);
    } finally {
      setIsLoadingMemories(false);
    }
  };

  useEffect(() => {
    loadMemories();
  }, []);

  // ==========================================
  // 4. CHAT AUTO SCROLL
  // ==========================================

  useEffect(() => {
    const chatPanel = chatPanelRef.current;

    if (chatPanel) {
      chatPanel.scrollTo({
        top: chatPanel.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isSending]);

  // ==========================================
  // 5. VOICE RESPONSE
  // ==========================================

  const speakResponse = (text) => {
    if (!voiceEnabled || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    speech.lang = "en-IN";
    speech.rate = 1;
    speech.pitch = 1;
    speech.volume = 1;

    const voices = window.speechSynthesis.getVoices();

    const preferredVoice =
      voices.find((voice) => voice.lang === "en-IN") ||
      voices.find((voice) => voice.lang.startsWith("en"));

    if (preferredVoice) {
      speech.voice = preferredVoice;
    }

    window.speechSynthesis.speak(speech);
  };

  // ==========================================
  // 6. ADD CHAT MESSAGE
  // ==========================================

  const addMessage = (sender, text, sources = []) => {
    setMessages((previous) => [
      ...previous,
      {
        id: `${Date.now()}-${Math.random()}`,
        sender,
        text,
        sources,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
  };

  // ==========================================
  // 7. SEND COMMAND TO BACKEND
  // ==========================================

  const sendCommand = async (userCommand) => {
    const cleanCommand = userCommand.trim();

    if (!cleanCommand || isSending) {
      return;
    }

    addMessage("user", cleanCommand);

    setCommand("");
    setMessage("");
    setIsSending(true);

    try {
      // Detect multi-step workflows
      const actionCount = (
        cleanCommand.match(/\b(open|launch|start)\b/gi) || []
      ).length;

      const isWorkflow = actionCount > 1;

      // Detect advertisements
      const advertisementPattern =
        /\b(advertisement|advertising|ad copy|facebook ad|instagram ad|google ad|youtube ad|create an ad|write an ad|make an ad|ad headline)\b/i;

      const isAdvertisement =
        !isWorkflow && advertisementPattern.test(cleanCommand);

      // Detect marketing requests
      const marketingPattern =
        /\b(marketing strategy|marketing plan|marketing campaign|promote|promotion|market my|advertising campaign)\b/i;

      const isMarketing =
        !isWorkflow &&
        !isAdvertisement &&
        marketingPattern.test(cleanCommand);

      // Detect content generation
      const contentPattern =
        /\b(email|social media post|instagram post|blog|article|project description|caption|professional message|speech|essay)\b/i;

      const contentActionPattern =
        /\b(write|draft|compose|generate|create)\b/i;

      const isContentGeneration =
        !isWorkflow &&
        !isMarketing &&
        !isAdvertisement &&
        contentActionPattern.test(cleanCommand) &&
        contentPattern.test(cleanCommand);

      // Select endpoint
      let endpoint = "/command";

      let requestBody = {
        command: cleanCommand,
      };

      if (isWorkflow) {
        endpoint = "/workflow";
      } else if (isAdvertisement) {
        endpoint = "/advertisement";

        requestBody = {
          product_name: cleanCommand,
          product_description: cleanCommand,
          target_audience:
            "Infer a suitable target audience and clearly state assumptions.",
          platform:
            "Use the platform mentioned in the request, otherwise Instagram.",
          advertisement_goal:
            "Use the goal mentioned in the request, otherwise increase sales.",
          tone: "Creative and persuasive",
        };
      } else if (isMarketing) {
        endpoint = "/marketing";

        requestBody = {
          business_name: "Not specified - infer from the request",
          product_or_service: cleanCommand,
          target_audience:
            "Infer a suitable target audience and clearly state assumptions.",
          marketing_goal: cleanCommand,
          budget:
            "Use the budget mentioned in the request, otherwise suggest low-budget options.",
          platform:
            "Use the platform mentioned in the request, otherwise recommend suitable platforms.",
        };
      } else if (isContentGeneration) {
        endpoint = "/generate-content";

        const matchedContent = cleanCommand.match(contentPattern);

        requestBody = {
          content_type: matchedContent
            ? matchedContent[0]
            : "general content",
          topic: cleanCommand,
          tone: "professional",
          additional_instructions: "",
        };
      }

      // Send request
      const response = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.detail ||
          "Request processing failed."
        );
      }

      // Prepare assistant response
      let reply;

      if (isAdvertisement) {
        reply = data.advertisement || "No advertisement was generated.";
      } else if (isMarketing) {
        reply = data.strategy || "No marketing strategy was generated.";
      } else if (isContentGeneration) {
        reply = data.content || "No content was generated.";
      } else {
        reply = data.message || "ZYRA has processed your command.";
      }

      // Display workflow results
      if (
        isWorkflow &&
        Array.isArray(data.steps) &&
        data.steps.length > 0
      ) {
        reply += "\n\nWorkflow details:\n";

        data.steps.forEach((step, index) => {
          reply += `\n${index + 1}. ${step.step}\n`;

          reply += step.success
            ? "   ✓ Completed"
            : `   ✗ Failed: ${step.message}`;
        });
      }

      addMessage(
        "assistant",
        reply,
        Array.isArray(data.sources) ? data.sources : []
      );

      speakResponse(reply);

      loadMemories();
      loadTaskHistory();
    } catch (error) {
      const errorReply =
        `Sorry, something went wrong. ${error.message}`;

      addMessage("assistant", errorReply);
      speakResponse(errorReply);
    } finally {
      setIsSending(false);
    }
  };

  // ==========================================
  // 8. HANDLE TYPED COMMANDS
  // ==========================================

  const handleCommand = (event) => {
    event.preventDefault();
    sendCommand(command);
  };

  // ==========================================
  // 9. START MICROPHONE
  // ==========================================

  const startListening = () => {
    if (isSending) return;

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage(
        "Voice recognition is not supported. Please use Google Chrome."
      );
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setMessage("ZYRA is listening. Speak your command...");
    };

    recognition.onresult = (event) => {
      const transcript =
        event.results[0][0].transcript.trim();

      if (transcript) {
        setCommand(transcript);
        setMessage(`You said: "${transcript}"`);

        recognition.stop();
        sendCommand(transcript);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setMessage(
          "Microphone permission denied. Allow microphone access."
        );
      } else if (event.error === "no-speech") {
        setMessage("No speech detected. Please try again.");
      } else {
        setMessage(`Voice recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      setMessage("Could not start the microphone. Please try again.");
    }
  };

  // ==========================================
  // 10. STOP MICROPHONE
  // ==========================================

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    setIsListening(false);
  };

  // ==========================================
  // 11. CLEANUP VOICE SERVICES
  // ==========================================

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // ==========================================
  // 12. VOICE SETTINGS
  // ==========================================

  const toggleVoice = () => {
    if (voiceEnabled) {
      window.speechSynthesis?.cancel();
    }

    setVoiceEnabled((previous) => !previous);
  };

  // Save voice preference in browser storage.
  useEffect(() => {
    localStorage.setItem(
      "zyra_voice_enabled",
      String(voiceEnabled)
    );
  }, [voiceEnabled]);

  // ==========================================
  // 13. ENABLE NOTIFICATIONS
  // ==========================================

  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      setMessage("Your browser does not support notifications.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();

      setNotificationPermission(permission);

      if (permission === "granted") {
        setMessage("ZYRA notifications enabled successfully!");
      } else if (permission === "denied") {
        setMessage(
          "Notifications are blocked. Allow them in Chrome site settings."
        );
      } else {
        setMessage("Notification permission was not granted.");
      }
    } catch (error) {
      console.error("Notification permission error:", error);
      setMessage(`Could not enable notifications: ${error.message}`);
    }
  };

  // ==========================================
  // 14. TEST DESKTOP NOTIFICATION
  // ==========================================

  const testDesktopNotification = () => {
    if (!("Notification" in window)) {
      setMessage("Your browser does not support notifications.");
      return;
    }

    if (Notification.permission !== "granted") {
      setNotificationPermission(Notification.permission);
      setMessage("Please enable notifications before testing.");
      return;
    }

    try {
      const notification = new Notification("ZYRA AI Test", {
        body: "Great! ZYRA desktop notifications are working!",
        icon: "/favicon.ico",
        tag: "zyra-test-notification",
        requireInteraction: true,
      });

      notification.onshow = () => {
        console.log("ZYRA test notification was displayed.");
      };

      notification.onerror = (event) => {
        console.error("ZYRA notification display error:", event);
      };

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      setMessage("Test notification was created. Check your desktop.");
    } catch (error) {
      console.error("Test notification error:", error);
      setMessage(`Notification error: ${error.message}`);
    }
  };

  // ==========================================
  // 15. CHECK DUE REMINDERS
  // ==========================================

  const checkDueReminders = async () => {
    if (
      notificationPermission !== "granted" ||
      notificationCheckRef.current
    ) {
      return;
    }

    notificationCheckRef.current = true;

    try {
      const response = await fetch(`${API}/reminders/due`);

      if (!response.ok) {
        throw new Error("Could not check reminders.");
      }

      const data = await response.json();

      const dueReminders = Array.isArray(data.reminders)
        ? data.reminders
        : [];

      console.log("ZYRA due reminders:", dueReminders);

      for (const reminder of dueReminders) {
        try {
          if (Notification.permission !== "granted") {
            break;
          }

          const notification = new Notification("ZYRA Reminder", {
            body: reminder.reminder_text,
            icon: "/favicon.ico",
            tag: `zyra-reminder-${reminder.id}`,
            requireInteraction: true,
          });

          notification.onclick = () => {
            window.focus();
            notification.close();
          };

          notification.onerror = (event) => {
            console.error("Reminder notification display error:", event);
          };

          const completeResponse = await fetch(
            `${API}/reminders/${reminder.id}/complete`,
            { method: "POST" }
          );

          if (!completeResponse.ok) {
            console.error(
              `Could not complete reminder ${reminder.id}.`
            );
          }
        } catch (error) {
          console.error("Reminder notification error:", error);
        }
      }
    } catch (error) {
      console.error("Reminder checking error:", error);
    } finally {
      notificationCheckRef.current = false;
    }
  };

  // ==========================================
  // 16. AUTOMATIC REMINDER CHECKING
  // ==========================================

  useEffect(() => {
    if (notificationPermission !== "granted") {
      return;
    }

    console.log("ZYRA automatic reminder checking started.");

    checkDueReminders();

    const reminderInterval = setInterval(() => {
      checkDueReminders();
    }, 15000);

    return () => clearInterval(reminderInterval);
  }, [notificationPermission]);

  // ==========================================
  // 17. CLEAR CONVERSATION HISTORY
  // ==========================================

  const clearChat = async () => {
    if (isSending) return;

    const confirmed = window.confirm(
      "Are you sure you want to permanently delete all conversation history?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${API}/conversations`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not clear history.");
      }

      setMessages([]);
      setMessage("Conversation history cleared successfully.");
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  // ==========================================
  // 18. SAVE A NEW MEMORY
  // ==========================================

  const addMemory = async (event) => {
    event.preventDefault();

    const cleanKey = memoryKey.trim();
    const cleanValue = memoryValue.trim();

    if (!cleanKey || !cleanValue) {
      setMemoryStatus(
        "Please enter both a memory name and its value."
      );
      return;
    }

    setIsSavingMemory(true);
    setMemoryStatus("");

    try {
      const response = await fetch(`${API}/memories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memory_key: cleanKey,
          memory_value: cleanValue,
          category: memoryCategory,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not save memory.");
      }

      setMemoryKey("");
      setMemoryValue("");
      setMemoryCategory("general");

      setMemoryStatus("Memory saved successfully!");

      await loadMemories();
    } catch (error) {
      setMemoryStatus(`Error: ${error.message}`);
    } finally {
      setIsSavingMemory(false);
    }
  };

  // ==========================================
  // 19. DELETE ONE MEMORY
  // ==========================================

  const deleteMemory = async (memoryId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this memory?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${API}/memories/${memoryId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not delete memory.");
      }

      setMemoryStatus("Memory deleted successfully.");

      await loadMemories();
    } catch (error) {
      setMemoryStatus(`Error: ${error.message}`);
    }
  };

  // ==========================================
  // 20. DELETE ALL MEMORIES
  // ==========================================

  const clearMemories = async () => {
    if (memories.length === 0) return;

    const confirmed = window.confirm(
      "This will permanently delete ALL saved memories. Continue?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${API}/memories`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not clear memories.");
      }

      setMemories([]);
      setMemoryStatus("All saved memories have been deleted.");
    } catch (error) {
      setMemoryStatus(`Error: ${error.message}`);
    }
  };

  // ==========================================
  // 21. FRONTEND UI
  // ==========================================

  return (
    <div className="app">

      {/* SIDEBAR */}

      <aside className="sidebar">
        <h2>✦ ZYRA AI</h2>

        <nav>
          <p
            className={activeSection === "dashboard" ? "active" : ""}
            onClick={() => navigateTo("dashboard")}
          >
            ⌂ Dashboard
          </p>

          <p
            className={activeSection === "assistant" ? "active" : ""}
            onClick={() => navigateTo("assistant")}
          >
            ✧ AI Assistant
          </p>

          <p
            className={activeSection === "memory-panel" ? "active" : ""}
            onClick={() => navigateTo("memory-panel")}
          >
            🧠 Memory Management
          </p>

          <p
            className={activeSection === "features" ? "active" : ""}
            onClick={() => navigateTo("features")}
          >
            ⚡ Features
          </p>

          <p
            className={activeSection === "task-history" ? "active" : ""}
            onClick={() => navigateTo("task-history")}
          >
            ▤ Task History
          </p>

          <p
            className={activeSection === "settings" ? "active" : ""}
            onClick={() => navigateTo("settings")}
          >
            ⚙ Settings
          </p>
        </nav>

        <div className="sidebar-bottom">
          <p>Personal AI Assistant</p>
          <small>Version 1.0</small>
        </div>
      </aside>

      {/* MAIN DASHBOARD */}

      <main className="main" id="dashboard">

        {/* HEADER */}

        <header>
          <div>
            <h1>Dashboard</h1>
            <p>Welcome to your personal AI workspace.</p>
          </div>

          <span className="status">
            ● {backendStatus}
          </span>
        </header>

        {/* AI CHAT ASSISTANT */}

        <section className="welcome" id="assistant">
          <h2>ZYRA AI Assistant</h2>

          <p>
            Chat with ZYRA using your keyboard or voice.
          </p>

          <div className="chat-panel" ref={chatPanelRef}>
            {messages.length === 0 && (
              <div className="chat-empty">
                <h3>✦ Hello! I'm ZYRA.</h3>

                <p>
                  Your personal AI assistant. Type a command or
                  press the microphone button to get started.
                </p>
              </div>
            )}

            {messages.map((chat) => (
              <div
                key={chat.id}
                className={`chat-message ${chat.sender}`}
              >
                <div className="chat-sender">
                  {chat.sender === "user" ? "You" : "ZYRA"}
                  <span>{chat.time}</span>
                </div>

                <div className="chat-bubble">
                  {chat.text}
                </div>

                {chat.sender === "assistant" &&
                  Array.isArray(chat.sources) &&
                  chat.sources.length > 0 && (
                    <div className="chat-sources">
                      <h4>🔗 Sources</h4>

                      {chat.sources.map((source, index) => {
                        const validUrl =
                          /^https?:\/\//i.test(source.url || "");

                        if (!validUrl) return null;

                        return (
                          <a
                            key={`${source.url}-${index}`}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {index + 1}.{" "}
                            {source.title || "Read Source"} ↗
                          </a>
                        );
                      })}
                    </div>
                  )}
              </div>
            ))}

            {isSending && (
              <div className="chat-message assistant">
                <div className="chat-sender">ZYRA</div>

                <div className="chat-bubble typing">
                  ZYRA is thinking...
                </div>
              </div>
            )}
          </div>

          {/* COMMAND INPUT */}

          <form className="command-box" onSubmit={handleCommand}>
            <input
              type="text"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="Type your message or command..."
              disabled={isSending}
            />

            <button
              type="submit"
              aria-label="Send message"
              disabled={isSending || !command.trim()}
            >
              {isSending ? "..." : "➤"}
            </button>
          </form>

          {/* VOICE AND NOTIFICATION CONTROLS */}

          <div className="voice-controls">
            <button
              type="button"
              className={`mic-button ${
                isListening ? "listening" : ""
              }`}
              onClick={isListening ? stopListening : startListening}
              disabled={isSending}
            >
              {isListening ? "■ Stop Listening" : "🎙 Start Talking"}
            </button>

            <button
              type="button"
              className="voice-toggle"
              onClick={toggleVoice}
            >
              {voiceEnabled
                ? "🔊 Voice Replies On"
                : "🔇 Voice Replies Off"}
            </button>

            <button
              type="button"
              onClick={enableNotifications}
              disabled={
                notificationPermission === "granted" ||
                notificationPermission === "unsupported" ||
                notificationPermission === "denied"
              }
            >
              {notificationPermission === "granted"
                ? "🔔 Notifications Enabled"
                : notificationPermission === "denied"
                ? "🔕 Notifications Blocked"
                : notificationPermission === "unsupported"
                ? "Notifications Unsupported"
                : "🔔 Enable Notifications"}
            </button>

            <button
              type="button"
              onClick={testDesktopNotification}
              disabled={notificationPermission !== "granted"}
            >
              🧪 Test Notification
            </button>

            <button
              type="button"
              className="clear-chat-button"
              onClick={clearChat}
              disabled={messages.length === 0 || isSending}
            >
              Clear Chat
            </button>
          </div>

          <small>
            {isSending
              ? "ZYRA is processing your command..."
              : isListening
              ? "Listening... Speak clearly."
              : "Type a message or press Start Talking."}
          </small>

          {message && (
            <div className="command-message" role="status">
              {message}
            </div>
          )}
        </section>

        {/* MEMORY MANAGEMENT */}

        <section
          className="memory-section"
          id="memory-panel"
        >
          <div className="memory-heading">
            <div>
              <h2>🧠 Memory Management</h2>

              <p>
                Manage the information ZYRA remembers about you.
              </p>
            </div>

            <span className="memory-count">
              {memories.length} saved
            </span>
          </div>

          {/* ADD MEMORY FORM */}

          <form className="memory-form" onSubmit={addMemory}>
            <h3>Add a New Memory</h3>

            <label htmlFor="memory-key">
              Memory name
            </label>

            <input
              id="memory-key"
              type="text"
              value={memoryKey}
              onChange={(event) => setMemoryKey(event.target.value)}
              placeholder="Example: preferred_language"
              required
            />

            <label htmlFor="memory-value">
              Memory value
            </label>

            <textarea
              id="memory-value"
              value={memoryValue}
              onChange={(event) => setMemoryValue(event.target.value)}
              placeholder="Example: I prefer simple English explanations."
              rows={3}
              required
            />

            <label htmlFor="memory-category">
              Category
            </label>

            <select
              id="memory-category"
              value={memoryCategory}
              onChange={(event) =>
                setMemoryCategory(event.target.value)
              }
            >
              <option value="general">General</option>
              <option value="name">Name</option>
              <option value="education">Education</option>
              <option value="learning_preference">
                Learning Preference
              </option>
              <option value="career_goal">Career Goal</option>
              <option value="current_learning">
                Current Learning
              </option>
            </select>

            <button type="submit" disabled={isSavingMemory}>
              {isSavingMemory ? "Saving..." : "+ Save Memory"}
            </button>
          </form>

          {memoryStatus && (
            <div className="memory-status" role="status">
              {memoryStatus}
            </div>
          )}

          {/* SAVED MEMORIES */}

          <div className="saved-memories">
            <div className="saved-memories-heading">
              <h3>Saved Memories</h3>

              <div>
                <button
                  type="button"
                  className="refresh-memory-button"
                  onClick={loadMemories}
                  disabled={isLoadingMemories}
                >
                  {isLoadingMemories ? "Loading..." : "↻ Refresh"}
                </button>

                <button
                  type="button"
                  className="delete-all-memory-button"
                  onClick={clearMemories}
                  disabled={memories.length === 0}
                >
                  Delete All
                </button>
              </div>
            </div>

            {isLoadingMemories ? (
              <p className="memory-empty">
                Loading memories...
              </p>
            ) : memories.length === 0 ? (
              <div className="memory-empty">
                <span>✦</span>
                <p>No saved memories yet.</p>

                <small>
                  Add a memory above or tell ZYRA something about yourself.
                </small>
              </div>
            ) : (
              <div className="memory-list">
                {memories.map((memory) => (
                  <div
                    className="memory-card"
                    key={memory.id}
                  >
                    <div className="memory-card-content">
                      <div className="memory-card-top">
                        <h4>{memory.memory_key}</h4>

                        <span>
                          {memory.category || "general"}
                        </span>
                      </div>

                      <p>{memory.memory_value}</p>

                      {memory.updated_at && (
                        <small>
                          Updated: {memory.updated_at}
                        </small>
                      )}
                    </div>

                    <button
                      type="button"
                      className="delete-memory-button"
                      onClick={() => deleteMemory(memory.id)}
                      aria-label={`Delete ${memory.memory_key}`}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* FEATURE CARDS */}

        <section className="cards" id="features">

          <div className="card">
            <span>⚡</span>
            <h3>Computer Automation</h3>
            <p>
              Launch applications, open websites, and automate workflows.
            </p>
            <strong>Available</strong>
          </div>

          <div className="card">
            <span>🤖</span>
            <h3>AI Assistant</h3>
            <p>
              Chat with ZYRA, generate content, and get intelligent responses.
            </p>
            <strong>Available</strong>
          </div>

          <div className="card">
            <span>📁</span>
            <h3>File Management</h3>
            <p>
              Manage files and folders using natural-language commands.
            </p>
            <strong>Available</strong>
          </div>

          <div className="card">
            <span>🎙️</span>
            <h3>Voice Assistant</h3>
            <p>
              Interact with ZYRA using voice commands and spoken replies.
            </p>
            <strong>Available</strong>
          </div>

          <div className="card">
            <span>🧠</span>
            <h3>Memory Management</h3>
            <p>
              Save, view, and manage information remembered by ZYRA.
            </p>
            <strong>Available</strong>
          </div>

          <div className="card">
            <span>📊</span>
            <h3>Task History</h3>
            <p>
              Review previous commands and their execution status.
            </p>
            <strong>Available</strong>
          </div>

        </section>

        {/* TASK HISTORY */}

        <section
          className="task-history-section"
          id="task-history"
        >
          <div className="task-history-heading">
            <div>
              <h2>▤ Task History</h2>
              <p>View all commands processed by ZYRA.</p>
            </div>

            <button
              type="button"
              onClick={loadTaskHistory}
              disabled={isLoadingTasks}
            >
              {isLoadingTasks ? "Loading..." : "↻ Refresh"}
            </button>
          </div>

          {taskHistoryError && (
            <p className="task-history-error">
              {taskHistoryError}
            </p>
          )}

          {isLoadingTasks ? (
            <p>Loading task history...</p>
          ) : taskHistory.length === 0 ? (
            <div className="task-history-empty">
              <span>✦</span>
              <p>No tasks recorded yet.</p>
              <small>
                Your completed commands will appear here.
              </small>
            </div>
          ) : (
            <div className="task-history-list">
              {taskHistory.map((task) => (
                <div
                  className="task-history-card"
                  key={task.id}
                >
                  <div className="task-history-info">
                    <h3>{task.command}</h3>
                    <p>Action: {task.action}</p>
                    <small>{task.timestamp}</small>
                  </div>

                  <span
                    className={`task-status ${
                      task.status === "completed"
                        ? "completed"
                        : task.status === "needs clarification"
                        ? "needs-clarification"
                        : "failed"
                    }`}
                  >
                    {task.status === "needs clarification"
                      ? "Needs clarification"
                      : task.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* RECENT ACTIVITY */}

        <section className="activity">
          <h2>Recent Activity</h2>

          <p>
            {
              messages.filter(
                (item) => item.sender === "user"
              ).length
            }{" "}
            commands sent in this session.
          </p>

          <small>Your current session's activity.</small>
        </section>

        {/* SETTINGS */}

        <section className="settings-section" id="settings">

          <div className="settings-heading">
            <div>
              <h2>⚙ Settings</h2>
              <p>Customize your ZYRA AI experience.</p>
            </div>

            <span className="settings-version">Version 1.0</span>
          </div>

          <div className="settings-list">

            {/* Voice settings */}

            <div className="settings-card">
              <div className="settings-icon">🔊</div>

              <div className="settings-info">
                <h3>Voice Responses</h3>
                <p>Allow ZYRA to speak its responses.</p>

                <strong>
                  {voiceEnabled ? "Enabled" : "Disabled"}
                </strong>
              </div>

              <button
                type="button"
                className="settings-button"
                onClick={toggleVoice}
              >
                {voiceEnabled ? "Turn Off" : "Turn On"}
              </button>
            </div>

            {/* Notification settings */}

            <div className="settings-card">
              <div className="settings-icon">🔔</div>

              <div className="settings-info">
                <h3>Desktop Notifications</h3>
                <p>Receive notifications for your reminders.</p>

                <strong>{notificationPermission}</strong>
              </div>

              <button
                type="button"
                className="settings-button"
                onClick={enableNotifications}
                disabled={
                  notificationPermission === "granted" ||
                  notificationPermission === "denied" ||
                  notificationPermission === "unsupported"
                }
              >
                {notificationPermission === "granted"
                  ? "Enabled"
                  : notificationPermission === "denied"
                  ? "Blocked"
                  : "Enable"}
              </button>
            </div>

            {/* Test notifications */}

            <div className="settings-card">
              <div className="settings-icon">🧪</div>

              <div className="settings-info">
                <h3>Test Notifications</h3>
                <p>Check whether desktop notifications are working.</p>
              </div>

              <button
                type="button"
                className="settings-button"
                onClick={testDesktopNotification}
                disabled={notificationPermission !== "granted"}
              >
                Test Now
              </button>
            </div>

            {/* Backend status */}

            <div className="settings-card">
              <div className="settings-icon">🖥️</div>

              <div className="settings-info">
                <h3>Backend Connection</h3>
                <p>Check the connection between ZYRA and its backend.</p>

                <strong>{backendStatus}</strong>
              </div>
            </div>

            {/* Clear history */}

            <div className="settings-card">
              <div className="settings-icon">🗑️</div>

              <div className="settings-info">
                <h3>Clear Conversation History</h3>
                <p>Permanently delete your saved conversations.</p>
              </div>

              <button
                type="button"
                className="settings-button danger"
                onClick={clearChat}
                disabled={messages.length === 0 || isSending}
              >
                Clear History
              </button>
            </div>

          </div>
        </section>

      </main>
    </div>
  );
}

export default App;
