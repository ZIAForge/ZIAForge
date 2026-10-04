# ZIAForge Naming Concept & Core Principles

> Historical design intent. This document preserves the project vision; it is not a current feature or security certification. For implemented behavior and limits, use [README](../README.md), [workflows](WORKFLOWS.md) and [provider compatibility](PROVIDER_COMPATIBILITY.md).

This document explains the conceptual background, positioning, naming rationale, and core operational principles of ZIAForge.

---

## 🧭 1. Concept and Naming Rationale

- **Project Name**: ZIAForge (CLI command: `ziaf`)
  - **ZIA**: Represents the initials of the creator, **Zadneprovsky Ivan Alexandrovich** (Заднепровский Иван Александрович). This explains the name's origin; it does not establish trademark clearance.
  - **Forge**: Reflects the concept of a developer's blacksmith shop or forge, where custom AI workflows are forged and refined rather than blindly run.
- **Positioning**: A locally running, open-source AI orchestrator operating under the **BYOK / BYOS (Bring Your Own Key / Bring Your Own Subscription)** paradigm.
- **Key Value Proposition**:
  - Developers connect directly to cloud APIs (Anthropic, Gemini, OpenAI) or local backends (Ollama) using their personal credentials, avoiding subscription markups or privacy leaks through third-party servers.
  - Full local control over directory access, file indexing, and shell execution.

---

## 💡 2. Core Principles

### 1. Spec-Driven & Test-Driven (TDD) Development
ZIAForge requires AI agents to think and verify before writing code. Tasks are dictated by a markdown file (`planning.md`) containing a list of unchecked requirements. Before applying changes, agents must write tests, verify they fail (Red phase), write implementation code, and verify they pass (Green phase).

### 2. Deep Telemetry & Real-Time Streaming
To move away from "black-box" systems, ZIAForge demands full transparency in agent execution:
- **Streaming of Thoughts**: The orchestrator streams raw reasoning steps and stdout logs token-by-token directly to the user interface (`stream: true`).
- **Speed & Reason Metrics**: Shows metrics in real time: **tokens/second**, time-to-first-token (TTFT), total thinking duration (for reasoning models like `o3-mini`), and cost indicators.

### 3. Safety Circuit Breakers
To prevent cloud token waste, ZIAForge includes strict circuit breakers:
- **Apology Loop Detection**: Intercepts terminal outputs to catch loops of apologies (e.g., "I apologize, let me fix that...") or repeating commands.
- **Failure Thresholds**: Automatically terminates task execution if unit tests fail 3 times consecutively on the same file, or if the loop exceeds 50 overall iterations.
- **Interactive Checkpoints**: Prompts the user to confirm high-risk actions (e.g. deleting files, running arbitrary setup scripts, or pushing branches to origin).
