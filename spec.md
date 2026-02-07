# Technical Specification: MedFlow WOW - Agentic AI System

**Version:** 2.1
**Date:** October 26, 2023
**Author:** Senior Frontend Engineering Team
**Status:** Approved for Implementation

---

## 1. Executive Summary

**MedFlow WOW** is a high-fidelity, client-side "Agentic AI" analytics platform designed for supply chain management in the medical device sector. Unlike traditional dashboards that are static and utilitarian, MedFlow WOW integrates advanced generative AI capabilities (Google Gemini) with a highly aesthetic, artistic user interface ("WOW UI").

The system is designed to ingest non-standardized supply chain datasets (CSV, JSON, TXT), normalize them into a strict internal schema, and provide immediate visual analytics. Beyond passive visualization, the system features an agentic pipeline where AI agents can reason about the data, detect anomalies, and generate executive summaries based on user-defined prompts and logic.

The application operates on a "Zero-Backend" architecture, performing all data parsing, aggregation, and visualization within the client's browser, ensuring low latency and data privacy (data is not persisted to a server, only sent to the LLM for analysis upon user request).

### 1.1 Key Differentiators
*   **Artistic Theming Engine:** 20+ distinct UI themes based on famous art styles (Monet, Van Gogh, Bauhaus, etc.) that dynamically alter color palettes, fonts, and layout densities.
*   **Agentic Pipeline:** A configurable, multi-step AI workflow where the output of one agent (e.g., "Summarizer") feeds into the context of the next (e.g., "Risk Analyst").
*   **Universal Data Ingestion:** robust parsing logic that maps various column names (e.g., "Qty", "Quantity", "Amount") to a unified internal schema.
*   **Hybrid Visualization:** Combines standard statistical charts (Recharts) with complex, physics-based network graphs (D3.js).

---

## 2. System Architecture

### 2.1 Tech Stack
The application is built as a Single Page Application (SPA) using the following technologies:

*   **Runtime:** Browser-based (Client-side execution).
*   **Core Framework:** React v19 (via ES Modules).
*   **Language:** TypeScript (Strict typing for data integrity).
*   **Styling:** Tailwind CSS (via CDN) for utility classes, coupled with dynamic inline styles for theme injection.
*   **Visualization:**
    *   **Recharts:** For deterministic statistical charts (Line, Bar, Area, Pie, Radar).
    *   **D3.js:** For force-directed network graph simulations.
*   **AI Integration:** `@google/genai` SDK for interfacing with Gemini 1.5/2.5 models.
*   **Icons:** Lucide React.
*   **Build System:** No-build / Browser-native ES module imports (via `importmap`).

### 2.2 Data Flow Architecture

1.  **Ingestion:** User uploads a file (CSV/JSON) or pastes text.
2.  **Normalization Service:** Raw text is parsed; keys are fuzzy-mapped to the `MedFlowRow` schema.
3.  **State Store:** Normalized data is stored in React State (`useState`), triggering re-renders.
4.  **Compute Layer:** `useMemo` hooks aggregate data for charts (Supplier Top 10, Trends, etc.) to ensure performance.
5.  **Agent Layer:** On demand, specific data aggregates are serialized to JSON and sent to the Gemini API via the `AgentPipeline`.
6.  **Presentation:** The UI renders components based on the selected `SkinType` (Theme) and `Lang` (Language).

---

## 3. Data Engineering & Schema

The integrity of the system relies on converting heterogeneous user input into a homogenous internal structure.

### 3.1 Internal Data Model (`MedFlowRow`)
Every record in the system is transformed into the following TypeScript interface:

```typescript
interface MedFlowRow {
  // Primary Keys & Metadata
  id: string;             // Internal unique identifier (generated)
  
  // Temporal Data
  Deliverdate: string;    // Raw string from input
  parsedDate: Date | null;// Javascript Date object for sorting/graphing

  // Entity Identifiers
  SupplierID: string;     // Normalized Supplier ID
  CustomerID: string;     // Normalized Customer ID
  UDID: string;           // Unique Device Identification
  LicenseNo: string;      // Regulatory License Number

  // Product Details
  DeviceNAME: string;     // Name of the medical device
  Category: string;       // e.g., "Cardiac", "Orthopedic"
  Model: string;          // Specific model number
  
  // Inventory Control
  LotNO: string;          // Batch/Lot number
  SerNo: string;          // Serial Number
  
  // Quantitative
  Number: number;         // Quantity (Negative indicates returns)
}
```

### 3.2 Normalization Logic (`normalizeRow`)
The `services/dataService.ts` module implements a heuristic normalization strategy. It uses case-insensitive definitions to map incoming fields to the internal schema.

*   **Quantity Mapping:** Looks for `Number`, `Qty`, `Quantity`, `Amount`.
*   **Date Mapping:** Looks for `Deliverdate`, `Date`, `DeliveryDate`.
*   **Product Mapping:** Looks for `DeviceNAME`, `Device`, `Product`, `Item`.

**Date Parsing Algorithm:**
1.  Check for YYYYMMDD string format (Regex: `^\d{8}$`).
2.  If match: Parse substrings for Year, Month, Day.
3.  If no match: Attempt standard `new Date()` constructor.
4.  Result: `parsedDate` object or `null`.

**Quantity Parsing:**
*   Removes non-numeric characters (keeping `-` and `.`).
*   Parses to Integer.
*   Fallback to `0` if `NaN`.

### 3.3 Data Quality Metrics
The system automatically calculates a `DataMetrics` object upon ingestion:
*   `totalRows`: Count of normalized records.
*   `totalUnits`: Sum of the `Number` field.
*   `uniqueSuppliers`: Count of distinct SupplierIDs.
*   `dateRange`: [Min Date, Max Date].
*   `parseFailures`: Count of rows that did not match the header count (CSV) or structure (JSON).
*   `missingValues`: Dictionary tracking nulls per column (Visualized in Quality tab).

---

## 4. User Interface & Theming (The "WOW" Factor)

The UI architecture is built around the concept of "Skins" rather than simple CSS stylesheets. This allows for drastic changes in atmosphere.

### 4.1 Skin Definition System
A `SkinDef` interface defines the artistic direction:

```typescript
interface SkinDef {
  name: string;      // Display name
  bgFrom: string;    // Gradient Start Color
  bgTo: string;      // Gradient End Color
  accent: string;    // Primary action color (Buttons, Charts)
  cardBg: string;    // Translucency settings for glassmorphism
  text: string;      // Base text color
  font: string;      // 'font-serif', 'font-sans', or 'font-mono'
}
```

### 4.2 Implemented Themes
The system implements 20 hardcoded themes in `constants.ts`, including:
*   **Monet:** Soft pastels, serif fonts, high blur (`backdrop-filter`).
*   **VanGogh:** Deep blues (`#1c2541`) and vibrant yellows (`#f4d35e`).
*   **Bauhaus:** Stark contrasts, geometric feel, sans-serif.
*   **Matrix/Hacker (via "Basquiat" or custom):** Dark modes with mono fonts.
*   **Ukiyo-E:** Desaturated naturals and soft pinks.

### 4.3 Layout Structure
1.  **Sidebar:** Fixed width (`w-64`), glassmorphism effect. Contains Navigation, Filter controls (collapsible), Theme toggles, Language toggles, and API Key input.
2.  **Main Stage:** Scrollable area containing the active tab's content.
3.  **Status Rail:** A horizontal bar at the top of the Main Stage displaying live system health: Rows loaded, Active Skin, API Key status.

### 4.4 Global Filtering System
The `GlobalFilters` state object controls visibility across *all* visualizations (Dashboard and Network Graph).
*   **Fields:** SupplierID, Category, LicenseNo, Model, LotNO, SerNo, CustomerID, TimeZone.
*   **Mechanism:** Filtering is applied via a `useMemo` hook that recalculates `filteredData` whenever `data` or `filters` change. All charts consume `filteredData`, not raw `data`.

---

## 5. Functional Modules

### 5.1 Dashboard Module
The primary view for situational awareness. It is composed of 3 tiers of visualization.

**Tier 1: KPI Cards**
*   Total Rows (Data volume).
*   Total Units (Inventory volume).
*   Unique Suppliers (Supply base diversity).
*   Unique Categories (Product diversity).

**Tier 2: Primary Analytics (Recharts)**
*   **Daily Volume Trend (Line Chart):** X-Axis = Date, Y-Axis = Aggregated Units. Shows temporal velocity of supply.
*   **Top Categories (Bar Chart):** Vertical layout. Ranked by total units.

**Tier 3: Advanced Analytics (New Interactions)**
*   **Supplier Performance (Bar Chart):** Top 10 Suppliers by volume.
*   **Cumulative Growth (Area Chart):** Running total of units over time (Integral of the Trend chart).
*   **Customer Distribution (Pie Chart):** Top 5 Customers + "Others".
*   **Top Models (Bar Chart):** Breakdown by specific device model.
*   **Weekly Activity (Radar Chart):** Aggregates volume by Day of Week (Sun-Sat) to detect shipping patterns/shifts.
*   **Returns Analysis (Bar Chart):** Filters specifically for negative `Number` values to visualize defects/returns by Category.

**Feature: Smart Analyst Questions**
A section containing 20 pre-generated analytical questions (e.g., "Which supplier has the highest delivery reliability?"). Clicking a question copies it to the clipboard, encouraging the user to paste it into the Agent prompt area.

### 5.2 Network Graph Module
A physics-based visualization using `d3-force`.
*   **Nodes:** Suppliers (Pink), Categories (Yellow), Customers (Green).
*   **Links:** Represent flow of goods. Thickness scales with `Math.sqrt(volume)`.
*   **Interaction:** Draggable nodes, tooltip on hover.
*   **Configuration:** A slider allows the user to adjust `Top N` to reduce graph clutter/noise.

### 5.3 Agentic AI Module
This module provides the "intelligence" layer.

**Pipeline Structure:**
Defined in YAML format (`DEFAULT_AGENTS_YAML`).
*   **defaults:** Global settings (temperature: 0.2, max_tokens: 2000).
*   **agents:** An array of steps.
    *   `id`: Step identifier.
    *   `system_prompt`: Persona definition (e.g., "You are a risk manager").
    *   `user_prompt_template`: The input template. Supports variable injection:
        *   `{{data_summary}}`: JSON summary of metrics.
        *   `{{previous_output}}`: The text response from the preceding agent step.

**Execution Logic:**
1.  **Context Assembly:** The system aggregates `filteredData` into a lightweight JSON summary (to save token costs). It does *not* send the raw CSV to avoid context window overflows.
2.  **Sequential Chaining:** Agents can be run individually or as a pipeline. Step 2 can read Step 1's output, enabling chain-of-thought reasoning (e.g., Step 1: Summarize -> Step 2: Find Anomalies in Summary).
3.  **API Integration:** Calls `services/geminiService.ts` which instantiates `GoogleGenAI`.

### 5.4 Data Manager Module
Handles the ETL (Extract, Transform, Load) process.
*   **Input Methods:**
    *   Direct Text Area paste.
    *   File Upload (hidden `<input type="file">` triggered by UI Card). Supports `.csv`, `.json`, `.txt`.
    *   "Load System Default": Injects `DEFAULT_FULL_DATASET`.
*   **Preview:** A table view of the parsed data.
    *   **Pagination Control:** User selects preview limit (10, 20, 50, 100 rows).
    *   **Visual Feedback:** Parsing errors trigger browser alerts; Success updates the `metrics` state.

---

## 6. Implementation Details

### 6.1 State Management (React)
The application relies heavily on React's `useState` for managing the application lifecycle.

| State Variable | Type | Description |
| :--- | :--- | :--- |
| `data` | `MedFlowRow[]` | The full, normalized dataset. |
| `metrics` | `DataMetrics` | Calculated statistics for the dataset. |
| `filters` | `GlobalFilters` | Current values for all sidebar filter inputs. |
| `pipeline` | `AgentPipeline` | The parsed object representation of the YAML configuration. |
| `theme` | `'light' | 'dark'` | Tailwind class toggle on `<html>`. |
| `skin` | `SkinType` | Current active artistic theme. |
| `csvText` / `inputText` | `string` | The raw input buffer. |

### 6.2 Performance Optimization
*   **`useMemo` for Filtering:** The filtering logic is computationally expensive (`O(N)`). It is wrapped in `useMemo` dependent on `[data, filters]` to prevent recalculation on unrelated renders (e.g., theme changes).
*   **`useMemo` for Chart Aggregation:** Aggregating 10,000 rows for a line chart is expensive. All chart data preparation is memoized.
*   **D3 Integration:** The Network Graph uses a `useRef` to access the DOM directly. D3 runs its own internal simulation loop (`requestAnimationFrame`). The component cleans up the simulation on unmount to prevent memory leaks.

### 6.3 Internationalization (I18N)
A dictionary object `I18N` maps keys (e.g., `dashboard`, `units`) to string values for `en` and `zh-TW`. The UI consumes `I18N[lang][key]`.

---

## 7. Security & API Handling

*   **API Key Storage:** The API key is stored in React State (`apiKey`). It is initialized from `process.env.API_KEY` (if available via build/env) but can be overridden by the user via the Sidebar input.
*   **Data Privacy:**
    *   No data is sent to any server *except* Google's Gemini API.
    *   Google Gemini API is called directly from the browser.
    *   Users are responsible for their own API keys.
*   **Context Window Safety:** The `runAgentStep` function specifically constructs a *summary* object (`totalUnits`, `uniqueSuppliers`, `topCategories`) rather than sending the full dataset. This prevents hitting the token limit (Context Window) of the Gemini Flash model and reduces cost/latency.

---

## 8. Requirements for Future Development

### 8.1 Testing Strategy
*   **Unit Tests:** Required for `parseData`, `normalizeRow`, and `calculateMetrics` functions to ensure data integrity.
*   **Integration Tests:** Ensure the YAML parser correctly generates the `pipeline` object.
*   **E2E Tests:** Verify the file upload -> parse -> visualize flow.

### 8.2 Browser Compatibility
*   Requires browsers supporting ES Modules and ES6+ syntax (Chrome 80+, Firefox 75+, Safari 13+).
*   Requires Web Audio API support if TTS (Text-to-Speech) is added in future iterations.

### 8.3 Mobile Responsiveness
*   The Sidebar is fixed (`w-64`). On mobile devices, this should be converted to a hamburger menu or a bottom sheet (currently not implemented, sidebar consumes screen space on small viewports).
*   Charts use `ResponsiveContainer`, so they will adapt to the available width of the main content area.

---

## 9. Appendix: Default Configurations

### 9.1 Default Dataset
A realistic dataset representing medical device shipments.
*   **Columns:** SupplierID, Deliverdate, CustomerID, LicenseNo, Category, UDID, DeviceNAME, LotNO, SerNo, Model, Number.
*   **Volume:** ~30 records in default string, scalable to thousands.

### 9.2 Default Agent Persona
*   **Analyst:** Focuses on statistical summary.
*   **Risk Manager:** Focuses on anomalies and continuity risks.

### 9.3 Supported File Types
*   **CSV:** Comma-separated values. Headers required.
*   **JSON:** Array of objects.
*   **TXT:** Treated as CSV parsing stream.

---

**End of Specification**
