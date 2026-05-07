# Gantt Flow - OCP Group

Gantt Flow is a smart, fully responsive, and ergonomic Gantt Chart generator built with React and Tailwind CSS. It is designed to visualize project timelines with precise auto-scaling and an intuitive interface tailored to OCP Group's visual identity.

## 🌟 Key Features

### 📊 Smart Visualization & Auto-scaling
- **Dynamic X-Axis**: Automatically scales from the earliest start date to the latest end date, adding perfectly padded margins.
- **Adaptive Tick Intervals**: Intelligently renders date ticks based on the total project duration (every 1, 3, or 7 days).
- **Auto-fit Layouts**: Row heights compress automatically when dealing with large numbers of tasks (20+) to keep the view compact without losing readability.
- **Dynamic Labels**: Task labels elegantly adjust based on the bar width—if a bar is too narrow, the label shifts gracefully to the right to prevent overlap.
- **Today Indicator**: A precise, red dashed line highlights the current date across the entire chart.

### 🎨 OCP Aesthetic
- Utilizes the official **OCP Green** color palette (`#007A3D`).
- Clean, alternating row backgrounds (`bg-white` and `bg-[#F8FDF9]`) for high legibility.
- Deeply embedded rounded corners, gentle drop shadows, and subtle grid lines.

### 📥 Instant Data Import
- Easily import data via **CSV files**.
- Automatically parses columns: `Secteur`, `date debut`, and `date fin` (supports `jj/mm/aaaa` formatting).
- Intelligently handles delimiters (semicolons, commas, or tabs).

### 📱 Fully Responsive
- **Desktop**: Expansive, full-width detailed layout.
- **Mobile & Tablet**: Smart horizontal overflow on the chart area while keeping the sector labels "sticky" to the left edge for constant context.

### 💾 Local Persistence
- Tasks are seamlessly saved to your browser's `localStorage` so your progress is never lost between sessions.

## 🛠️ Tech Stack
- **React 19**
- **Vite**
- **Tailwind CSS v3**

## 🚀 Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Open the application:**
   Navigate to the URL provided by Vite (e.g., `http://localhost:5173/`).

## 📁 CSV Import Format
When uploading a CSV file, ensure it follows this exact structure:
```csv
Secteur;date debut;date fin
ARRET LG;13/04/2026;26/04/2026
DECANTEUR TH002;20/04/2026;01/05/2026
DECANTEUR TH003;14/04/2026;18/04/2026
COMMUN;28/04/2026;30/04/2026
FLOTTATION;17/04/2026;06/05/2026
PARC;13/04/2026;06/05/2026
```

## ☁️ Deployment
This app is ready to be hosted on **Vercel** or any static hosting platform. A `vercel.json` is included to ensure clean SPA routing.
