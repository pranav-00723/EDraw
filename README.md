# EDraw — Interactive Engineering Graphics Simulator & AI Solver

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Standards: BIS SP 46:2003](https://img.shields.io/badge/Standard-BIS_SP_46%3A2003-orange.svg)](https://standardsbis.bsbedge.com/)
[![Standards: ISO 128](https://img.shields.io/badge/Standard-ISO_128-green.svg)](https://www.iso.org/standard/60458.html)
[![TypeScript](https://img.shields.io/badge/TypeScript-React_19-blue?logo=typescript)](https://www.typescriptlang.org/)
[![WebGL / Three.js](https://img.shields.io/badge/3D_Engine-Three.js-black?logo=three.js)](https://threejs.org/)

> **Bridging the 3D-to-2D spatial reasoning gap in engineering education through interactive WebGL simulation and multimodal AI problem solving.**

---

## 💡 The Core Idea & Educational Need

**Engineering Graphics** (Orthographic Projection of Points, Lines, Planes, and Solids) is the foundational universal language of engineering. Across global engineering curricula (AICTE, Anna University, VTU, Mumbai University, KTU, ABET-accredited programs), over **80% of first-year engineering students** report that spatial visualization is their hardest conceptual bottleneck.

### The Problem:
* **The Static Paper Barrier:** Traditional textbooks (N.D. Bhatt, K. Venugopal, Basant Agrawal) teach 3D spatial principles on static 2D paper. Students struggle to mentally fold and unfold the Horizontal Plane (HP) and Vertical Plane (VP) along the ground line $XY$.
* **The "Black Box" Solution Gap:** When practicing homework or past exam questions, students only see the final drafted answer. They cannot inspect *why* an arc swings at an apparent angle, *how* loci are established, or *why* a perpendicular line collapses into a single coincident plan view $a(b)$.
* **Drafting Standard Ambiguity:** Students frequently confuse First-Angle vs. Third-Angle conventions, invert apparent angles ($\alpha, \beta$) with true inclinations ($\theta, \phi$), or draw dimension arrows incorrectly.

### The EDraw Solution:
**EDraw** is an intelligent educational simulation platform that fuses **interactive 3D WebGL spatial mechanics**, **vectorized 2D orthographic drafting**, and **multimodal AI question parsing**. A student can point their smartphone camera at any textbook problem, and EDraw extracts the geometric constraints, unfolds the spatial planes in real-time, animates the physical drafting compass, and renders the exact BIS SP 46-compliant solution.

---

## 🚀 Key Features & Innovations

### 1. 📷 Multimodal AI "Scan Q ➔ Ans" Engine
- **Physical Paper to Geometric Solution:** Point a camera, upload an image of a handwritten or printed textbook problem, or paste raw text.
- **Strict Geometric Transcription:** Built with the `@google/genai` TypeScript SDK and a high-precision computational geometry parsing engine.
- **Unambiguous Constraint Extraction:**
  - True Length ($TL$) and End Point Coordinates relative to HP and VP.
  - True Inclination with HP ($\theta$) and VP ($\phi$).
  - Parallelism and Perpendicularity constraints (e.g. automatically setting $\text{DEP} = 0$, $\theta = 90^\circ$, and coincident plan label $a(b)$).
  - Tolerant regex fallbacks to execute offline even without cloud API latency.

### 2. 🌐 Interactive 3D Spatial Unfolding (Three.js WebGL)
- **True Dihedral Angle Representation:** Visualizes the line or point suspended in 3D Euclidean space within the principal reference planes (Horizontal Plane $\text{HP}$ and Vertical Plane $\text{VP}$).
- **First-Angle Plane Unfolding:** Real-time demonstration of the standard convention—the Horizontal Plane unfolds **$90^\circ$ Clockwise** around the ground line $XY$, proving visually why Top Views (Plans) project below $XY$ and Front Views (Elevations) project above $XY$.
- **Orbit, Pan, and View Presets:** Freely inspect the object in Isometric, Elevation (Front), Plan (Top), or Side views with customizable plane colors.

### 3. 📐 Step-by-Step Pictorial Drafting Companion
- **Real-Time Compass Sweeps:** Animates the physical drafting process across 4 sequential stages:
  1. *Step 1:* Draw Ground Line $XY$ and erect thin continuous reference projectors ($2H$ pencil).
  2. *Step 2:* Apply True Inclinations ($\theta, \phi$) with True Length ($TL$) to establish horizontal loci lines.
  3. *Step 3:* Swing the Rotating Line Method arcs using the animated drafting compass with apparent radii.
  4. *Step 4:* Draw thick continuous finished elevation $a'b'$ and plan $ab$ ($HB$ pencil) with projector alignment verification.
- **Instrument Guidance:** Recommends specific drafting instruments (T-Square, $30^\circ\text{--}60^\circ$ and $45^\circ$ Set Squares, Protractor, Compass) for each stroke.

### 4. 🎯 Rigorous Engineering Geometry & Traces
- **Rotating Line Method:** Dynamically calculates True Length ($TL$), Apparent Elevation Length ($EL$), Apparent Plan Length ($PL$), True Angles ($\theta, \phi$), Apparent Angles ($\alpha, \beta$), and Distance Between Projectors ($DEP$).
- **Traces Calculation & Visualization:** Locates the Horizontal Trace ($HT$, point $h$) and Vertical Trace ($VT$, point $v'$) where the extended line penetrates the reference planes.
- **Apparent Values Solver:** Solves under-constrained problems where True Length is unknown and must be derived from apparent lengths ($a'b'$, $ab$) and projector distance ($DEP$) across all four quadrants (i, ii, iii, iv).

### 5. 🖨️ BIS SP 46:2003 & ISO 128 Standards Adherence
- Clean, grid-free orthographic workspace.
- Proper line weight hierarchy ($2H$ thin construction lines vs. $HB$ thick object lines).
- Outward-facing dimension line arrowheads facing extension limits.
- High-resolution **2x PNG vector export** for laboratory record submissions and classroom presentations.

---

## 🏛️ Supported Modules

| Module | Core Concepts Simulated |
| :--- | :--- |
| **Module 1: Projections of Points** | • Points in all 4 Quadrants (1st, 2nd, 3rd, 4th)<br>• Points lying in HP, in VP, or on the $XY$ reference axis<br>• Real-time 3D quadrant bounding box & 2D orthographic alignment<br>• Coordinate convention: Above HP (+), Below HP (-), In Front of VP (+), Behind VP (-) |
| **Module 2: Projections of Straight Lines** | • Line Parallel to Both Planes<br>• Line Perpendicular to HP and Parallel to VP (single-point top view $a(b)$)<br>• Line Perpendicular to VP and Parallel to HP (single-point front view $a'(b')$)<br>• Line Parallel to one plane and Inclined to the other<br>• Line Inclined to both HP and VP (Oblique Lines)<br>• Rotating Line Method & Loci generation<br>• Traces ($HT, h, h'$ and $VT, v, v'$) |

---

## 🛠️ Architecture & Tech Stack

```
EDraw Architecture
├── Frontend (React 19 + TypeScript + Vite)
│   ├── Three.js Canvas          --> 3D Dihedral cutting plane & unfolding viewer
│   ├── SVG Orthographic Engine  --> 2D Drawing canvas, locus lines, dimensions, compass arcs
│   ├── Drafting Simulator       --> 4-stage step-by-step procedural construction
│   └── Tailwind CSS v4          --> Responsive engineering workstation UI (Light/Dark)
└── Backend (Node.js + Express via tsx)
    ├── /api/scan-question       --> Multimodal AI question transcription & parsing
    ├── @google/genai SDK        --> Gemini-powered structured schema extraction
    └── Rule-Based Fallback      --> Offline deterministic regex & geometry parser
```

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Motion, Lucide Icons.
- **3D Graphics:** Three.js (WebGL Perspective & Orthographic renderers).
- **Backend:** Node.js, Express, `tsx`.
- **AI & Computer Vision:** Google Gen AI SDK (`@google/genai`).

---

## 🏁 Quickstart & Installation

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### 1. Clone the Repository
```bash
git clone https://github.com/pranav-00723/EDraw.git
cd EDraw
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables (Optional for AI scanning)
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
```
*(Note: If no API key is provided, EDraw automatically falls back to its deterministic rule-based computational geometry parser for all textbook problems.)*

### 4. Run the Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:3000` to start exploring.

### 5. Build for Production
```bash
npm run build
npm start
```

---

## 📖 Example Walkthrough: The Classroom Perpendicular Problem

Consider the textbook problem:
> *"A Line AB 25mm is parallel to the VP and perpendicular to the HP. Point A is 35mm above the HP and 20mm in front of the VP. B is 10 mm above the HP. Draw its projections."*

1. **Input:** Scan via camera, click the preset classroom problem, or paste the text.
2. **AI Analysis:**
   - Detects `is_perpendicular_to_hp = true` $\rightarrow \theta = 90^\circ, \text{DEP} = 0$.
   - Detects `is_parallel_to_vp = true` $\rightarrow \phi = 0^\circ$.
   - Determines End A: $(35, 20)$ and End B: $(10, 20)$.
3. **Execution:**
   - **Front View ($a'b'$):** Drawn as a vertical line of True Length $25\text{ mm}$ between $10\text{ mm}$ and $35\text{ mm}$ above the $XY$ ground line.
   - **Top View ($a(b)$):** Collapses to a single point $20\text{ mm}$ below the $XY$ line with label $a(b)$.
   - **3-Tier Dimensioning:** Accurately labels heights $10\text{ mm}$, $25\text{ mm}$, and depth $20\text{ mm}$ with outward-pointing arrows.

---

## 🗺️ Roadmap & Future Scope

- [x] **Module 1:** Projections of Points (4 Quadrants & Boundary Conditions).
- [x] **Module 2:** Projections of Straight Lines (True Length, Angles, Traces, Rotating Line Method).
- [x] **Multimodal AI Solver:** Mobile camera capture + OCR + structured constraint extraction.
- [ ] **Module 3: Projections of Planes:** Triangular, Square, Pentagonal, Hexagonal, and Circular Lamina inclined to HP and VP.
- [ ] **Module 4: Projections of Solids:** Prisms, Pyramids, Cylinders, and Cones with axis inclined to reference planes.
- [ ] **Module 5: Sections of Solids & Development of Surfaces:** True shape of sections and parallel-line / radial-line developments.
- [ ] **Interactive AR Mode:** WebXR / AR camera view projecting virtual 3D projection planes directly onto student drawing tables.

---

## 📄 License & Academic Integrity

This project is licensed under the **Apache License 2.0**. Designed to empower engineering educators, laboratory instructors, and undergraduate engineering students worldwide. Adheres strictly to **BIS SP 46:2003** and **ISO 128** technical engineering standards.
