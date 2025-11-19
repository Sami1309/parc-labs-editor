# AI Video Researcher

An agentic research tool for video creators, built with Next.js, React Flow, Gemini, and Exa.

## Features

- **Visual Workflow**: Interactive node-based interface.
- **Agentic Search**: Uses Gemini to plan research and Exa to find high-quality results.
- **Deep Dive**: Automatically finds relevant articles, snippets, and sources.

## Setup

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create a `.env.local` file with your API keys:
    ```env
    GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
    EXA_API_KEY=your_exa_api_key
    ```
4.  Run the development server:
    ```bash
    npm run dev
    ```

## Usage

1.  Click the "Start Research" node.
2.  Enter your video topic or idea in the prompt bar.
3.  Watch as the AI agent researches and generates result nodes.
