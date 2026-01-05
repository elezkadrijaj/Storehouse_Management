# Storehouse Management System

A robust, full-stack ERP solution designed to automate and centralize core warehouse operations for multi-branch businesses. This project demonstrates enterprise-level architecture and real-time data handling.

## 🏗️ Architecture & Patterns
This project was built with **maintainability** and **testability** in mind, utilizing:
*   **Hexagonal Architecture (Ports & Adapters):** Decoupling the core business logic from external dependencies (DB, UI).
*   **Repository Pattern:** Abstracting data access to ensure the application is not hard-coded to a specific ORM.
*   **Dependency Injection:** Utilizing .NET's native DI container for modularity.

## 🛠️ Tech Stack
*   **Backend:** .NET Core Web API (C#)
*   **Frontend:** React.js (Vite) with Bootstrap
*   **Database:** MSSQL (Relational) & MongoDB (Dynamic data)
*   **Real-time:** SignalR (WebSockets) for instant notifications
*   **ORM:** Entity Framework Core

## 🚀 Key Features
*   **Multi-Warehouse Support:** Manage separate inventories across different geographical locations.
*   **Order Lifecycle Management:** Full tracking from "Created" to "Completed" with automated PDF invoice generation.
*   **Real-Time Communication:** In-app messaging and status updates via SignalR.
*   **Inventory Control:** Advanced filtering and stock level monitoring.
*   **Role-Based Access Control (RBAC):** Distinct permissions for Admin, Manager, and Worker roles.

## 🚦 Getting Started
1. Clone the repo: `git clone https://github.com/elezkadrijaj/Storehouse_Management`
2. Update `appsettings.json` with your ConnectionStrings.
3. Run `dotnet ef database update`.
4. Run the backend and the React frontend separately.
