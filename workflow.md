graph TD
    subgraph User_Interaction
        A[User] -->|Login/Signup| B[Authentication]
        B --> C[EcoLens Dashboard]
    end

    subgraph Visual_Scanner
        C --> D[Upload Image]
        D --> E[Gemini Classification]
        E --> F{Traffic Image?}
        F -->|Yes| G[YOLO Helmet Detection]
        F -->|No| H[Skip Helmet]
        G --> I{Helmet Worn?}
        I -->|No| J[Add No Helmet Violation]
        I -->|Yes| K[No Helmet Violation Added]
        J --> L[Gemini: Fetch Helmet Fine]
        L --> M[Violation List]
        K --> M
        H --> M
        E --> N[Gemini: Violation Detection<br/>Traffic & Environmental]
        N --> O[Filter out Helmet Violations]
        O --> M
        M --> P[Merge & Calculate Total Fine]
    end

    subgraph Report_Submission
        P --> Q[User confirms report]
        Q --> R[GPS Location & Category]
        R --> S[TomTom API: Nearest Authority]
        S --> T[Send Email Alert to Authority]
        T --> U[Store Report in MongoDB]
    end

    subgraph Additional_Modules
        C --> V[Digital Glovebox]
        V --> W[Upload Documents]
        W --> X[Gemini Document Scan]
        X --> Y[Store in MongoDB<br/>+ Expiry Tracking]
        
        C --> Z[Legal Advisor]
        Z --> AA[User Query + Language]
        AA --> AB[Gemini Legal Analysis]
        AB --> AC[Penalty, Law, Resolution, Appeal]
        AC --> AD[Save & Show]

        C --> AE[EcoMap]
        AE --> AF[Route Search]
        AF --> AG[OSRM Routing API]
        AG --> AH[Calculate CO₂ / Fuel / Eco‑Score]
        AE --> AI[Overpass API: Sensitive Zones]
        AI --> AJ[Display Zones on Map]
        AE --> AK[Real‑time Navigation]
        AK --> AL[Geolocation + Voice Guidance]
        AK --> AM[Proximity Alerts for Sensitive Zones]
    end

    subgraph Notifications
        U --> AN[Daily Expiry Reminders]
        AN --> AO[Email Alerts to User]
    end

    style J fill:#ffcccc,stroke:#ff0000
    style O fill:#ccffcc,stroke:#00aa00
    style S fill:#ffffcc,stroke:#ffaa00