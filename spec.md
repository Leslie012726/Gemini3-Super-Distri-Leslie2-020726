# MedFlow WOW: Agentic AI Supply Chain Analytics Platform
## Technical Specification Document

**Version:** 2.2.0
**Date:** October 26, 2023
**Status:** Approved for Development
**Document Classification:** Technical Design Authority

---

## 1. Executive Summary

**MedFlow WOW** represents a paradigm shift in supply chain analytics applications. Traditionally, medical device logistics dashboards are utilitarian, static, and require rigid data schemas. MedFlow WOW disrupts this by introducing an **"Agentic AI"** architecture combined with a high-fidelity, artistic user interface engine known as the **"WOW UI"**.

The system is a Single Page Application (SPA) designed to run entirely client-side ("Zero-Backend"). It ingests non-standardized heterogeneous datasets (CSV, JSON, TXT) related to medical device shipments, normalizes them using heuristic algorithms, and provides immediate, interactive visualization.

Beyond standard descriptive analytics, MedFlow WOW integrates the **Google Gemini API** to offer prescriptive and predictive capabilities. It features a configurable **Agent Pipeline** where autonomous AI agents can be chained together to perform complex reasoning tasks—such as summarizing delivery performance, detecting anomalies in lot numbers, or assessing supply continuity risks—based on the live data context.

This specification details the architecture, data models, user interface design patterns, and functional logic required to implement the system.

---

## 2. System Architecture

### 2.1 Technological Stack

The application is built on a modern, lightweight, and performant stack designed for browser-native execution without the need for complex build steps or backend servers.

*   **Runtime Environment:** Modern Web Browser (Chrome 90+, Firefox 88+, Safari 14+) supporting ES Modules.
*   **Core Framework:** **React 19** (accessed via ESM CDN). React is chosen for its component-based architecture and efficient DOM reconciliation, which is crucial for updating complex dashboards.
*   **Language:** **TypeScript**. Strict typing is enforced to ensure data integrity across the normalization and visualization layers.
*   **State Management:** React Native Hooks (`useState`, `useReducer`, `useContext`). No external state libraries (Redux, Zustand) are used to maintain simplicity and reduce bundle size.
*   **Styling Engine:** **Tailwind CSS** (via CDN) for utility-first styling, combined with dynamic inline styles for the "Skin" theming engine.
*   **Visualization Libraries:**
    *   **Recharts:** For deterministic, statistical charts (Line, Bar, Area, Pie, Radar). Chosen for its composability and React integration.
    *   **D3.js (v7):** For physics-based network simulations. Chosen for its raw calculation power in handling force-directed graphs.
*   **AI Integration:** **@google/genai SDK**. Direct browser-to-API communication with Gemini 1.5/2.5 models.
*   **Icons:** **Lucide React**. A consistent, stroke-based icon set.

### 2.2 High-Level Architecture Diagram

The system follows a unidirectional data flow:

1.  **Input Layer:** User provides data via File Upload, Paste, or System Default.
2.  **ETL Layer (Service):** `dataService.ts` parses raw text, applies normalization heuristics, and generates a `MedFlowRow` array.
3.  **State Layer:** The normalized data and computed metrics are stored in the root `App` component state.
4.  **Filter Layer:** A `useMemo` hook applies global filters (Supplier, Category, Date, etc.) to produce `filteredData`.
5.  **Presentation Layer:** `filteredData` is consumed by the active Tab View (Dashboard, Network, Data Manager).
6.  **Intelligence Layer:** On user request, specific subsets of `filteredData` are serialized and sent to the `AgentPipeline` (Gemini Service) for analysis.

---

## 3. Data Engineering & Schema Specification

A core requirement of MedFlow WOW is the ability to handle "dirty" or non-standard data. The system implements a robust schema mapping strategy.

### 3.1 The Internal Data Model (`MedFlowRow`)

Regardless of the input format, all data is transformed into the canonical `MedFlowRow` interface. This ensures that downstream components (Charts, Agents) always have a predictable data structure.

```typescript
export interface MedFlowRow {
  // System Fields
  id: string;             // Unique internal identifier (e.g., "row-0", "row-1")
  
  // Temporal Data
  Deliverdate: string;    // The raw date string from the source
  parsedDate: Date | null;// A unified JavaScript Date object used for sorting and time-series graphing

  // Entity Identifiers
  SupplierID: string;     // Normalized Supplier Identifier
  CustomerID: string;     // Normalized Customer Identifier
  UDID: string;           // Unique Device Identification (Medical standard)
  LicenseNo: string;      // Regulatory License Number (e.g., FDA or local health authority)

  // Product Taxonomy
  DeviceNAME: string;     // Descriptive name of the medical device
  Category: string;       // Broad classification (e.g., "Cardiac", "Orthopedic")
  Model: string;          // Specific model number or SKU
  
  // Inventory & Traceability
  LotNO: string;          // Manufacturing Lot/Batch number
  SerNo: string;          // Serial Number for individual unit tracking
  
  // Quantitative Metrics
  Number: number;         // The quantity of units. Negative values explicitly denote Returns/RMA.
}
```

### 3.2 Normalization Heuristics (`normalizeRow`)

The `normalizeRow` function in `services/dataService.ts` is the engine of the ETL layer. It employs a **Case-Insensitive Fuzzy Matching** strategy to map incoming JSON keys or CSV headers to the internal schema.

**Mapping Logic:**

*   **Quantity:** The system scans the input row for keys matching: `['Number', 'Qty', 'Quantity', 'Amount']`. The first match is used. Non-numeric characters are stripped (except `-` and `.`), and the result is parsed as a Float/Int. Defaults to `0`.
*   **Date:** Scans for `['Deliverdate', 'Date', 'DeliveryDate']`.
*   **Product:** Scans for `['DeviceNAME', 'Device', 'Product', 'Item']`.
*   **Supplier:** Scans for `['SupplierID', 'Supplier', 'Vendor']`.
*   **Category:** Scans for `['Category', 'Type', 'Class']`.

**Date Parsing Algorithm:**
Medical supply chains often use legacy date formats. The parser prioritizes the compact `YYYYMMDD` format common in EDI (Electronic Data Interchange).

1.  **Regex Check:** Test against `/^\d{8}$/`.
2.  **EDI Parse:** If matched, split string indices `0-4` (Year), `4-6` (Month), `6-8` (Day). Note: Month is 0-indexed in JS.
3.  **Fallback:** If no match, pass the string to the standard `new Date(string)` constructor.
4.  **Validation:** If the resulting object is `Invalid Date`, set `parsedDate` to `null`.

### 3.3 Data Metrics & Quality

Upon ingestion, the system calculates a `DataMetrics` object to provide immediate feedback on data health:
*   **Parse Failures:** Counts rows where CSV columns < Header columns.
*   **Missing Values:** Tracks `null` or empty strings per column.
*   **Temporal Extents:** Identifies the Min and Max dates to auto-scale charts.

---

## 4. User Interface Specification: The "WOW" Engine

The User Interface is designed to be immersive rather than purely functional. It leverages a **"Skinning"** system that goes beyond simple color swaps.

### 4.1 Skin Definition (`SkinDef`)

Each theme is defined by a rigorous set of properties that control the atmosphere of the application.

*   `name`: The display name (e.g., "Van Gogh").
*   `bgFrom` / `bgTo`: Defines a linear gradient that serves as the application backdrop.
*   `accent`: A high-contrast color used for primary actions (Buttons) and critical data points (Chart lines).
*   `cardBg`: An RGBA color value. This is critical for the **Glassmorphism** effect, determining the tint and opacity of the content panels.
*   `text`: The primary font color, optimized for contrast against the gradient.
*   `font`: The typeface classification (`font-serif`, `font-sans`, `font-mono`).

### 4.2 Artistic Themes

The system includes 20+ preset skins inspired by art history. Examples include:

*   **Monet:** Uses pastel blues and greys (`#A8C0D0`) with a serif font to evoke an impressionist water lily pond. High transparency in cards.
*   **Van Gogh:** Deep starry-night blues (`#1c2541`) contrasted with vibrant sunflower yellows (`#f4d35e`).
*   **Bauhaus:** Minimalist. Whites, greys, and primary red accents (`#ef233c`) with sans-serif typography for a structural feel.
*   **Basquiat (Dark Mode):** Deep purples and blacks (`#10002b`) with chaotic orange accents (`#ff9e00`) and a monospace font.

### 4.3 Layout & Navigation

*   **Sidebar Navigation:** A fixed-width (`256px`) glass panel on the left. It houses the primary navigation tabs, the collapsible **Global Filter** panel, and system controls (Theme toggle, Language toggle, API Key input).
*   **Main Stage:** The remaining width. It scrolls vertically and houses the dynamic content of the active module.
*   **Status Rail:** A floating "pill" header in the Main Stage. It provides constant visibility of system status:
    *   **Row Count:** Current dataset size vs filtered size.
    *   **Active Skin:** Current aesthetic theme.
    *   **API Status:** Visual indicator (Green/Red dot) showing if the Gemini API key is present.

---

## 5. Functional Module Specifications

### 5.1 Dashboard Module

The Dashboard is the command center, organized into three tiers of information density.

**Tier 1: KPI Cards**
Four large cards displaying high-level aggregates:
1.  **Rows:** Total count of filtered records.
2.  **Total Units:** Sum of quantities (colored Green).
3.  **Suppliers:** Count of unique supplier entities.
4.  **Categories:** Count of unique product categories.

**Tier 2: Primary Analytics (Temporal & Categorical)**
1.  **Daily Volume Trend (Line Chart):**
    *   **X-Axis:** Date (formatted `MM-DD`).
    *   **Y-Axis:** Total Units.
    *   **Interaction:** Tooltip shows exact volume per day.
    *   **Insight:** Reveals delivery velocity and seasonality.
2.  **Top Categories (Bar Chart - Vertical):**
    *   **Y-Axis:** Category Name.
    *   **X-Axis:** Total Units.
    *   **Sorting:** Descending by volume.
    *   **Limit:** Controlled by `Top N` filter.

**Tier 3: Advanced Analytics (Interactive Visualizations)**
1.  **Top Suppliers (Bar Chart):** Focuses on vendor performance. Visualizes the top 10 suppliers by volume.
2.  **Cumulative Growth (Area Chart):** Calculates the running total of units over time. This represents the integral of the Trend chart and visualizes total inventory accumulation.
3.  **Customer Distribution (Pie Chart):** Shows the market share of top 5 customers. Remaining customers are aggregated into an "Others" slice to maintain readability.
4.  **Top Models (Bar Chart):** Granular view of specific device models (SKUs) driving volume.
5.  **Weekly Activity (Radar Chart):** Aggregates unit volume by day of the week (Sun-Sat). This helps identify shipping patterns (e.g., "Does Supplier X only deliver on Mondays?").
6.  **Returns Analysis (Bar Chart):** Specifically filters for rows where `Number < 0`. Visualizes which categories have the highest return rates (negative volume), surfacing quality control issues.

**Smart Analyst Questions:**
A UI component containing 20 pre-engineered analytical questions (e.g., "Identify outliers in shipment quantities"). Clicking a question copies it to the clipboard, bridging the gap between passive visualization and active AI analysis.

### 5.2 Network Graph Module

This module visualizes the supply chain as a connected graph topology using **D3.js**.

*   **Nodes:**
    *   **Supplier (Pink):** The source of goods.
    *   **Category (Yellow):** The intermediate classification.
    *   **Customer (Green):** The destination.
*   **Links:** Represent the flow of volume.
    *   **Width:** Proportional to `Math.sqrt(volume)`.
*   **Simulation:** Uses `d3.forceSimulation` with:
    *   `forceLink`: Binds nodes together.
    *   `forceManyBody`: Repels nodes to prevent overlap (Charge: -200).
    *   `forceCenter`: Keeps the graph centered in the viewport.
    *   `forceCollide`: Prevents nodes from physically clipping into each other.
*   **Interactivity:** Nodes are draggable. Hovering reveals specific volume data.

### 5.3 Agentic AI Module ("Agents")

This is the core differentiator of MedFlow WOW. It allows users to run "Pipelines" of AI reasoning.

**Pipeline Configuration (YAML):**
Pipelines are defined in a YAML editor within the app.
*   **defaults:** Global `temperature` and `max_tokens`.
*   **agents:** A list of steps.
    *   `id`: Unique ID.
    *   `provider`: Currently locked to `gemini`.
    *   `model`: Specifically `gemini-3-flash-preview`.
    *   `system_prompt`: Defines the AI's persona (e.g., "You are a Supply Chain Risk Manager").
    *   `user_prompt_template`: The instruction. It supports Handlebars-style variable injection.
        *   `{{data_summary}}`: Injects a compressed JSON summary of the current filtered data.
        *   `{{previous_output}}`: Injects the text response from the *immediate predecessor* agent.

**Execution Flow:**
1.  User clicks "Run Pipeline" or "Run Step".
2.  System constructs the prompt by replacing template variables with live state data.
3.  Request is sent to Gemini API.
4.  Response is streamed back/displayed in the "Agent Output" terminal.
5.  State is updated, allowing subsequent agents to read the new output.

### 5.4 Data Manager Module

Provides controls for the ETL process.

*   **File Upload:** A drag-and-drop zone supporting `.csv`, `.json`, and `.txt`.
*   **Direct Paste:** A text area for copy-pasting raw data.
*   **System Default:** A button to load the built-in `DEFAULT_FULL_DATASET`.
*   **Preview Table:** A tabular view of the normalized `data`. Users can toggle the view limit (10, 20, 50, 100 rows) to verify parsing correctness without rendering the full DOM.

### 5.5 Global Filters

A comprehensive set of filters located in the Sidebar affects **all** modules (Dashboard, Network, Agents).

*   `searchSupplier`: Fuzzy string match on SupplierID.
*   `category`: Fuzzy string match on Category.
*   `licenseNo`: Filtering by regulatory license.
*   `model`: Filtering by device model.
*   `lotNo`: Traceability filter for specific batches.
*   `serNo`: Traceability filter for specific serial numbers.
*   `customerID`: Filtering by client.
*   `topN`: Numeric slider (5-50) controlling the density of charts and the network graph.

---

## 6. Service Layer Specification

### 6.1 Data Service (`dataService.ts`)

Responsible for all parsing logic.

*   **`parseData(input)`**: Detects format (JSON vs CSV).
*   **`parseCSV(text)`**: Splits by newline. Handles quoted CSV fields (e.g., `"Stent, Cardiac"`). Maps headers to schema.
*   **`parseJSON(text)`**: Parses string. Handles nested arrays if wrapped in a root object property.
*   **`calculateMetrics(data)`**: Performs a single pass over the normalized array (`O(N)`) to compute totals, ranges, and unique sets. This avoids re-iterating for basic stats later.

### 6.2 Gemini Service (`geminiService.ts`)

A lightweight wrapper around `@google/genai`.

*   **Function:** `callGeminiAgent`.
*   **Parameters:** `apiKey`, `modelName`, `systemInstruction`, `prompt`, `maxTokens`.
*   **Error Handling:** Catches API errors (401, 500) and returns a user-friendly error string to the UI agent terminal.
*   **Model Enforcement:** Defaults to `gemini-3-flash-preview` if an invalid model is requested, ensuring compatibility with the specific prompt structure used.

---

## 7. State Management & Performance

### 7.1 React State Architecture

The application state is centralized in `App.tsx` but logically segmented:

1.  **Configuration State:** `theme`, `skin`, `lang`, `apiKey`. (Persists for session).
2.  **Data State:** `inputText` (Raw), `data` (Normalized), `metrics` (Meta).
3.  **Filter State:** `filters` object.
4.  **Agent State:** `agentsYaml` (Config), `pipeline` (Parsed Object), `skillMd` (Context).

### 7.2 Memoization Strategy

Rendering performance is critical when handling thousands of rows.

*   **`filteredData`:** Computed via `useMemo`. Dependencies: `[data, filters]`. This ensures that changing a visual theme or switching tabs does *not* trigger a re-filter operation (O(N)).
*   **Chart Aggregates:** `trendData`, `catData`, `supplierData`, etc., are all derived via `useMemo` from `filteredData`. This ensures that charts only recalculate when the underlying data subset changes.
*   **D3 Simulation:** Run inside a `useEffect` and detached from the standard React render cycle. It directly manipulates the DOM (SVG) for performance, bypassing React's virtual DOM overhead for high-frequency physics updates.

---

## 8. Security & Privacy

MedFlow WOW adheres to a **Client-Side Privacy** model.

1.  **Data Persistence:** Application data (`data`, `metrics`) exists **only in the browser's memory** (RAM). It is not written to `localStorage`, `IndexedDB`, or sent to any telemetry server. Refreshing the page clears the data.
2.  **API Keys:** The Google Gemini API Key is stored in React state. It is passed directly to the Google endpoint. Intermediate servers are not used.
3.  **LLM Privacy:**
    *   **Context Control:** The system does **not** send the full CSV dataset to the LLM by default.
    *   **Summary Only:** The default `user_prompt_template` injects `{{data_summary}}`, which contains only aggregated metrics (Total Units, Date Range, Top 5 Categories). This prevents accidental leakage of PII (Personally Identifiable Information) or specific Serial Numbers unless the user explicitly modifies the Agent prompt to include row-level data.

---

## 9. Future Roadmap & Constraints

### 9.1 Known Constraints
*   **Browser Memory:** Large datasets (>100MB CSVs) may crash the browser tab as parsing is synchronous and held in JS Heap.
*   **Token Limits:** While `gemini-3-flash` has a large context window, extremely complex pipelines with full history injection may hit limits.
*   **Mobile Experience:** The layout assumes a desktop viewport (Sidebar fixed width). Mobile responsiveness is limited to basic stacking; chart interaction is suboptimal on touch.

### 9.2 Roadmap
1.  **Web Workers:** Offload `parseData` and `normalizeRow` to a Web Worker to prevent UI freezing during large file uploads.
2.  **Streaming Parsing:** Implement `PapaParse` or similar stream-based parsing for massive files.
3.  **Prompt Library:** Allow users to save/load their own YAML pipeline configurations to LocalStorage.
4.  **TTS Integration:** Utilize the Web Audio API to have the Agent "speak" the Executive Summary.

---

**End of Specification**
