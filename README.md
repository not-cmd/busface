# GuardianRoute: AI-Powered School Bus Safety Platform

GuardianRoute is a comprehensive, AI-enhanced platform designed to ensure the safety and security of students during their school bus commute. It provides real-time tracking, automated attendance, and seamless communication channels for school administrators, bus staff, and parents, creating a transparent and secure ecosystem.

## Technology Stack

The application is built on a modern, robust, and scalable tech stack:

-   **Frontend:** [Next.js](https://nextjs.org/) with [React](https://reactjs.org/) and [TypeScript](https://www.typescriptlang.org/) for building a fast and maintainable user interface.
-   **UI Components:** [ShadCN UI](https://ui.shadcn.com/) for a set of beautifully designed and accessible components.
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/) for a utility-first CSS framework that enables rapid UI development.
-   **Backend & Real-time Data:** [Firebase Realtime Database](https://firebase.google.com/docs/database) is used as the central nervous system of the app, providing live data synchronization for bus locations, attendance status, chat messages, and alerts across all user dashboards.
-   **Generative AI:** [Google's Genkit](https://firebase.google.com/docs/genkit), integrated with the Gemini family of models, powers the application's intelligent features.
-   **Mapping:** [Mapbox](https://www.mapbox.com/) is used to render live bus and student location data on interactive maps.
-   **Deployment:** The application is configured for deployment on [Firebase App Hosting](https://firebase.google.com/docs/app-hosting).

---

## Core Features & How They Work

GuardianRoute is divided into three primary user-facing dashboards: Admin, Parent, and Bus Staff. Each dashboard is tailored to the specific user's needs and is powered by a shared real-time backend.

### 1. AI-Powered Attendance & Intruder Detection

This is the most advanced feature of the application, using computer vision to automate the attendance process and enhance security.

**Pipeline:**
1.  **Parent-Side Face Registration:** A parent initiates the process by using their device's camera to capture a series of images of their child from different angles, guided by on-screen prompts (`FaceRegistration` component). These images are captured as Base64-encoded Data URIs.
2.  **Submission for Approval:** The captured images are sent to the Firebase Realtime Database under a `pendingFaceRegistrations` path, along with the student's ID, name, and a timestamp.
3.  **Admin Approval:** The Admin Dashboard listens for new entries in `pendingFaceRegistrations`. The `FaceApprovalCard` component displays these pending requests, allowing an administrator to visually verify the photos and either approve or reject the registration.
4.  **Secure Storage:** Upon approval, a server-side action (`reviewFaceRegistrationAction`) is triggered. It moves the approved photo data from `pendingFaceRegistrations` to a secure `registeredFaces/{studentId}` path in the database. If rejected, the pending entry is simply removed.
5.  **Real-Time Scanning:** The Bus Staff dashboard features a "Live Security Feed" (`LiveFeed` component). When the staff member clicks "Start Scanning", the component accesses the device's camera to capture a continuous video stream.
6.  **AI Face Detection Flow:** Every few seconds, the `LiveFeed` component captures a frame from the video stream as a high-quality PNG Data URI. This frame is sent to a Genkit AI flow (`detectFace` flow) along with the list of all registered student faces (also as Data URIs) from the `registeredFaces` path in the database.
7.  **AI Analysis:** The `detectFace` flow, powered by a Gemini vision model, performs the following analysis on the server:
    -   It detects all human faces present in the frame.
    -   For each detected face, it compares it against the provided database of registered student photos.
    -   It assigns a stable Unique ID (UID) to each detected face, which remains consistent for the same person across different frames.
    -   The flow returns an array of face objects, each containing a bounding box, confidence score, the recognized student's name (if matched), or `null` if unrecognized.
8.  **Event Handling & UI Feedback:** The `LiveFeed` component receives the AI's response and takes action:
    -   **Recognized Student:** If a face matches a registered student who is supposed to be on that bus, their attendance status in the database is automatically updated to "On Board", and a snapshot is saved to `studentEvents/{studentId}` for the parent to view. A green box is drawn around their face on the live feed.
    -   **Intruder Alert:** If a face is detected but does not match any registered student in the database, it is flagged as an "Intruder." A snapshot is taken and saved to the `intruderAlerts` path in the database, which appears on the Admin Dashboard's Intruder Alerts card. A red box is drawn around the unrecognized face.
    -   **Wrong Bus Alert:** If a recognized student is detected on a bus they are not assigned to, a "Wrong Bus" warning is displayed on the live feed with a blue box drawn around their face, preventing them from boarding the incorrect bus.

### 2. Live Bus Tracking

Provides real-time visibility of the entire bus fleet for admins and the specific bus for a parent.

**Pipeline:**
1.  **GPS Data Collection:** The Bus Staff device, via the `SpeedTracker` component, uses the browser's Geolocation API (`navigator.geolocation.watchPosition`) to continuously get the bus's current latitude, longitude, and speed.
2.  **Real-time Database Update:** This location data, along with a link to a placeholder CCTV feed image, is written to the Firebase Realtime Database under a `busLocations/{busId}` path every few seconds.
3.  **Map Display:** The Admin Dashboard's `LiveMapCard` subscribes to the entire `busLocations` path, while the Parent and Bus Staff dashboards' maps subscribe to a specific `busLocations/{busId}` path.
4.  **Live Updates:** As soon as the location data is updated in the database, the `onValue` listener in the `LiveMapCard` component fires. This updates the component's state, causing the marker on the Mapbox map to instantly move to the new position, providing a smooth, live view of the bus's location.

### 3. AI-Generated Summaries & Safety Scores

GuardianRoute leverages Genkit to provide actionable insights from raw data.

-   **Attendance Summary (`AttendanceSummaryCard`):** An admin can select a date from a calendar. The application then pulls all attendance records for that day from the database and sends them as a JSON string to the `generateAttendanceSummary` Genkit flow. The AI analyzes this structured data and returns a natural language summary, highlighting trends, marking discrepancies, and noting any potential issues.
-   **Driver Safety Score (`buses/page.tsx`):** An admin can click "Gen AI Score" for any driver. This action triggers the `generateSafetyScore` Genkit flow. The flow is provided with a sample of recent driving events (like speeding or harsh braking). The AI model calculates a daily safety score out of 100 based on these events and provides a brief, constructive summary explaining what influenced the score.

### 4. Integrated Messaging & Chatbot

A direct line of communication between parents and the school, with an AI-powered first line of support.

**Pipeline:**
1.  **Parent Initiates Chat:** A parent uses the `ChatbotCard` on their dashboard to ask a question. The component provides quick-access buttons for common queries (ETA, location).
2.  **Bot Response (Intent Matching):** For simple, predefined questions, the message is handled client-side by a basic intent-matching system. For example, if a message contains "ETA," the bot provides the current ETA from the student's data without needing an admin.
3.  **Admin Handoff:** If the bot cannot answer or the parent explicitly types "talk to admin," the system seamlessly escalates the chat. It posts a message indicating the handoff and sets an `unreadByAdmin` flag to `true` in the `chats/{studentId}` path in the database.
4.  **Real-time Messaging:** All messages are stored and synced via the `chats/{studentId}/messages` path in the Firebase Realtime Database. The `MessagingCard` on the student's detail page allows an admin to see the full chat history and reply directly to the parent in real-time. Sending a message as an admin clears the `unreadByAdmin` flag. Unread message notifications also appear on the main student list to alert the admin.

### 5. Emergency & Alert System

The platform includes a system for handling immediate and high-priority events.

-   **Panic Button (`EmergencyCard`):** An admin can press a "Panic Button" which simulates sending an immediate, high-priority alert to all relevant parties by displaying a system-wide toast notification.
-   **Automated Alerts (`AlertsCard`):** The system is designed to generate alerts for various events. For instance, speeding events from `SpeedTracker` or intruder detections from `LiveFeed` write data to specific paths in the database (e.g., `alerts/speeding`, `intruderAlerts`). The `AlertsCard` on the Admin Dashboard subscribes to these paths and displays new alerts as they arrive.