# QuantumIDE: A Cloud-Based Integrated Development Environment with Container Isolation

## Quick Setup Guide

### Prerequisites
- Node.js 20.x or higher ([Download](https://nodejs.org/))
- Docker Engine ([Install Guide](https://docs.docker.com/engine/install/))
- PostgreSQL 15.x or higher ([Download](https://www.postgresql.org/download/))
- Git ([Download](https://git-scm.com/downloads))

### Installation Steps

```bash
# 1. Clone the repository
git clone https://github.com/kumar-ankit-100/QuantumIDE.git
cd QuantumIDE

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env.local
# Edit .env.local with your configuration:
# DATABASE_URL="postgresql://user:password@localhost:5432/quantumide"
# NEXTAUTH_SECRET="your-secret-key-here"
# NEXTAUTH_URL="http://localhost:3001"
# GITHUB_TOKEN="your-github-token" (optional)
# GOOGLE_API_KEY="your-google-ai-key" (optional)

# 4. Setup database
npx prisma generate
npx prisma migrate dev

# 5. Start the development server
npm run dev
```

Access the application at **http://localhost:3001**

### Troubleshooting
- **Docker not running**: Start Docker Desktop or Docker daemon
- **Port 3001 already in use**: Stop other applications or change port in server.ts
- **Database connection error**: Verify PostgreSQL is running and DATABASE_URL is correct
- **Container creation fails**: Ensure Docker has sufficient permissions

---

## Abstract

QuantumIDE represents a comprehensive cloud-based integrated development environment built on modern web technologies and containerization principles. The system provides developers with a fully-featured coding environment accessible through web browsers, eliminating the need for local development environment setup. This document presents a detailed technical analysis of the system architecture, implementation details, and operational workflows.

## 1. Introduction

### 1.1 System Overview

QuantumIDE is a web-based integrated development environment that leverages Docker containerization to provide isolated development environments for multiple users simultaneously. The system integrates real-time collaboration features, version control through GitHub, and artificial intelligence-powered code assistance. Each user session operates within an isolated Docker container, ensuring security and resource management while maintaining consistent development environments.

### 1.2 Core Objectives

The primary objectives of this system include:

- Providing browser-accessible development environments without local installation requirements
- Ensuring complete isolation between user projects through containerization
- Integrating version control systems for continuous code persistence
- Offering real-time collaborative features through WebSocket communication
- Implementing AI-assisted coding capabilities for enhanced developer productivity
- Maintaining scalable architecture supporting concurrent user sessions

## 2. System Architecture

### 2.1 High-Level Architecture

The system follows a three-tier architecture pattern consisting of presentation, application, and data layers. The architectural design emphasizes separation of concerns and modularity to ensure maintainability and scalability.

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer (Browser)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Monaco     │  │   XTerm.js   │  │  React UI    │     │
│  │   Editor     │  │   Terminal   │  │  Components  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                    HTTP/WebSocket
                            │
┌─────────────────────────────────────────────────────────────┐
│                  Application Layer (Next.js)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Next.js Server (Port 3001)               │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │  │
│  │  │   API      │  │  WebSocket │  │   Auth     │    │  │
│  │  │   Routes   │  │   Server   │  │  Middleware│    │  │
│  │  └────────────┘  └────────────┘  └────────────┘    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                    Docker API / PostgreSQL
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Docker     │  │  PostgreSQL  │  │   GitHub     │     │
│  │   Engine     │  │   Database   │  │     API      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

#### 2.2.1 Frontend Technologies

- React 19.1.0: Component-based user interface library
- Next.js 15.5.5: Server-side rendering and routing framework
- Monaco Editor: Code editor component providing VSCode-like editing experience
- XTerm.js 5.5.0: Terminal emulator for browser-based command-line interface
- Framer Motion: Animation library for enhanced user experience
- Tailwind CSS: Utility-first CSS framework for responsive design

#### 2.2.2 Backend Technologies

- Node.js Runtime: Server-side JavaScript execution environment
- Next.js API Routes: RESTful API endpoint implementation
- WebSocket (ws 8.18.3): Real-time bidirectional communication protocol
- Dockerode 4.0.9: Docker Engine API client for container management
- Prisma 6.17.1: Type-safe database ORM
- NextAuth 4.24.11: Authentication and session management

#### 2.2.3 Infrastructure Components

- Docker Engine: Container runtime for isolated execution environments
- PostgreSQL: Relational database for persistent data storage
- GitHub API: Version control integration through Octokit
- Google Generative AI: Artificial intelligence code assistance

## 3. Database Schema and Data Model

### 3.1 Entity Relationship Model

The system employs a relational database model with two primary entities: User and Project. The schema design follows normalization principles to ensure data integrity and minimize redundancy.

```
┌─────────────────────────┐
│         User            │
├─────────────────────────┤
│ id (PK)      : String   │
│ name         : String?  │
│ email (UQ)   : String   │
│ password     : String   │
│ createdAt    : DateTime │
└─────────────────────────┘
            │
            │ 1:N
            │
            ▼
┌─────────────────────────┐
│       Project           │
├─────────────────────────┤
│ id (PK)      : String   │
│ name         : String   │
│ description  : String?  │
│ template     : String   │
│ githubRepo   : String?  │
│ containerId  : String?  │
│ userId (FK)  : String   │
│ createdAt    : DateTime │
│ updatedAt    : DateTime │
└─────────────────────────┘
```

### 3.2 Schema Specifications

#### 3.2.1 User Entity

The User entity maintains authentication credentials and profile information. The password field stores bcrypt-hashed values ensuring secure credential storage. The email field enforces uniqueness constraints to prevent duplicate accounts.

#### 3.2.2 Project Entity

The Project entity represents individual development projects with the following key attributes:

- template: Specifies the initial project framework (Next.js, React, Node.js, etc.)
- githubRepo: Stores the associated GitHub repository URL for version control
- containerId: References the Docker container ID for active sessions
- userId: Foreign key establishing ownership relationship with User entity

The cascading delete relationship ensures that project deletion removes all associated container resources and file systems.

## 4. Container Isolation Architecture

### 4.1 Isolation Principles

QuantumIDE implements strict isolation between user projects through Docker containerization. Each project operates within a dedicated container instance, providing process-level isolation, filesystem isolation, and network isolation.

### 4.2 Container Lifecycle Management

```
User Request → Project Creation
    │
    ├─→ Container Initialization
    │   ├─→ Pull Base Image (node:20)
    │   ├─→ Create Container with Port Mappings
    │   ├─→ Mount Project Volume
    │   └─→ Start Container Process
    │
    ├─→ Environment Setup
    │   ├─→ Initialize Git Repository
    │   ├─→ Install Project Dependencies
    │   ├─→ Configure Development Server
    │   └─→ Write Metadata Configuration
    │
    └─→ Container Active State
        ├─→ Terminal Access (exec)
        ├─→ File Operations (read/write)
        ├─→ Process Management
        └─→ Port Forwarding (3000-3007, 5173-5180)
```

### 4.3 Resource Allocation

Each container receives predefined resource allocations:

- CPU: Shared allocation with Docker scheduler
- Memory: Configurable limits per container
- Network: Bridge network with port mapping
- Storage: Ephemeral container filesystem with volume mounts

### 4.4 Port Mapping Strategy

The system allocates port ranges for different development server types:

- Ports 3000-3007: Next.js and Node.js servers
- Ports 5173-5180: Vite development servers

Port mapping enables external access to containerized development servers through the host system, allowing preview functionality in the browser.

## 5. Request Processing Flow

### 5.1 User Authentication Flow

```
1. User Submits Credentials
   │
   ├─→ POST /api/auth/signin
   │   ├─→ Validate Email Format
   │   ├─→ Query Database for User
   │   ├─→ Verify Password (bcrypt)
   │   └─→ Generate JWT Token
   │
2. Session Establishment
   │
   ├─→ Store JWT in HTTP-only Cookie
   ├─→ Create NextAuth Session
   └─→ Redirect to Dashboard
   │
3. Subsequent Requests
   │
   ├─→ Middleware Validates JWT
   ├─→ Extract User Context
   └─→ Authorize Resource Access
```

### 5.2 Project Creation Workflow

```
1. User Initiates Project Creation
   │
   ├─→ POST /api/projects/create
   │   ├─→ Validate Template Selection
   │   ├─→ Generate Unique Project ID
   │   └─→ Create Database Record
   │
2. Container Provisioning
   │
   ├─→ Docker Container Creation
   │   ├─→ Pull Base Image if Missing
   │   ├─→ Configure Port Bindings
   │   ├─→ Set Environment Variables
   │   └─→ Start Container Instance
   │
3. Project Initialization
   │
   ├─→ Template Deployment
   │   ├─→ Extract Template Files
   │   ├─→ Write to Container Filesystem
   │   └─→ Execute npm install
   │
4. GitHub Integration
   │
   ├─→ Create Repository (if enabled)
   │   ├─→ Initialize Git in Container
   │   ├─→ Add Remote Origin
   │   ├─→ Commit Initial Files
   │   └─→ Push to GitHub
   │
5. Development Server Launch
   │
   ├─→ Background Process Execution
   │   ├─→ Start npm run dev
   │   ├─→ Monitor Server Startup
   │   └─→ Detect Active Port
   │
6. Response to Client
   │
   └─→ Return Project Metadata
       ├─→ Container ID
       ├─→ Preview URL
       └─→ Project Status
```

### 5.3 File Operations Pipeline

The system implements a sophisticated file management pipeline enabling real-time code editing within containers:

```
File Read Request:
  User Action → GET /api/projects/[id]/files/read
    │
    ├─→ Authenticate User Session
    ├─→ Validate Project Ownership
    ├─→ Resolve Container Reference
    ├─→ Execute: docker exec cat /app/filepath
    ├─→ Stream File Contents
    └─→ Return to Monaco Editor

File Write Request:
  User Saves Code → POST /api/projects/[id]/files/write
    │
    ├─→ Authenticate User Session
    ├─→ Validate Project Ownership
    ├─→ Resolve Container Reference
    ├─→ Create Temporary File
    ├─→ Execute: docker cp to Container
    ├─→ Broadcast WebSocket Update
    └─→ Confirm Write Success
```

### 5.4 Terminal Interaction Model

The terminal functionality provides direct shell access to containers through the XTerm.js interface:

```
Terminal Session Establishment:
  Client Opens Terminal → POST /api/projects/[id]/terminal
    │
    ├─→ Create Docker Exec Instance
    │   ├─→ Command: /bin/bash
    │   ├─→ AttachStdin: true
    │   ├─→ AttachStdout: true
    │   ├─→ AttachStderr: true
    │   └─→ Tty: true
    │
    ├─→ Start Exec Stream
    │   ├─→ Bidirectional Communication
    │   ├─→ Handle Input from Client
    │   └─→ Stream Output to Client
    │
    └─→ Maintain Session State
        ├─→ Working Directory Tracking
        ├─→ Command History Management
        └─→ Environment Variable Persistence
```

## 6. Real-Time Communication Architecture

### 6.1 WebSocket Implementation

The system employs WebSocket protocol for real-time bidirectional communication, significantly reducing latency compared to HTTP polling approaches.

```
WebSocket Server Architecture:

Server Initialization (Port 3001):
  ├─→ HTTP Server Creation
  ├─→ Next.js Handler Integration
  └─→ WebSocket Server Setup (/api/ws)

Client Connection Flow:
  1. Client Connects
     ├─→ URL: ws://localhost:3001/api/ws?projectId={id}
     ├─→ Validate Project ID Parameter
     └─→ Create Client Instance

  2. Subscription Management
     ├─→ Client Subscribes to Channels
     │   ├─→ 'port': Development server port updates
     │   └─→ 'files': File system change notifications
     │
     └─→ Server Maintains Subscription Map
         └─→ Map<ProjectId, Set<Client>>

  3. Event Broadcasting
     ├─→ Port Detection Event
     │   ├─→ Monitor Container Logs
     │   ├─→ Detect Server Startup
     │   └─→ Broadcast Port Information
     │
     └─→ File Change Event
         ├─→ Detect File Modification
         └─→ Notify Subscribed Clients
```

### 6.2 Port Detection Mechanism

The system implements an intelligent port detection mechanism to identify development server availability:

```
Port Detection Algorithm:

1. Initial Inspection
   ├─→ Query Container Port Mappings
   └─→ Validate Port Bindings Exist

2. Log Analysis
   ├─→ Execute: cat /tmp/dev-server.log
   ├─→ Parse Server Startup Messages
   ├─→ Extract Port Numbers
   │   ├─→ Pattern: localhost:(\d+)
   │   ├─→ Pattern: 0.0.0.0:(\d+)
   │   └─→ Pattern: port[:\s]+(\d+)
   │
   └─→ Validate Port Range (3000-9999)

3. Port Mapping Resolution
   ├─→ Match Internal Port to Host Port
   ├─→ Construct Preview URL
   └─→ Broadcast to WebSocket Clients

4. Caching Strategy
   ├─→ Store Detected Port Information
   ├─→ Prevent Redundant Broadcasts
   └─→ Update Only on Port Change
```

## 7. Version Control Integration

### 7.1 GitHub Synchronization

The system provides seamless GitHub integration for version control:

```
Repository Creation Process:

1. User Enables GitHub Integration
   │
   ├─→ Validate GitHub Token
   ├─→ Create Repository via Octokit
   │   ├─→ Repository Name: Project Name
   │   ├─→ Visibility: Private/Public
   │   └─→ Auto-initialize: false
   │
2. Container Git Configuration
   │
   ├─→ Execute: git init
   ├─→ Configure User Identity
   │   ├─→ git config user.name "QuantumIDE"
   │   └─→ git config user.email "ide@quantumide.dev"
   │
3. Remote Configuration
   │
   ├─→ Add Remote Origin
   │   └─→ URL: https://{token}@github.com/{owner}/{repo}.git
   ├─→ Create Initial Commit
   └─→ Push to Main Branch

Automatic Synchronization:

1. File Save Event Triggers
   │
   ├─→ Accumulate Changes
   └─→ Debounce Commit (prevent excessive commits)

2. Auto-commit Process
   │
   ├─→ Execute: git add .
   ├─→ Check Status: git status --porcelain
   ├─→ Commit Changes: git commit -m "Auto-save"
   └─→ Push: git push origin main

3. Cleanup Integration
   │
   ├─→ Final Commit Before Shutdown
   ├─→ Ensure Remote Synchronization
   └─→ Container Removal After Push Success
```

## 8. Artificial Intelligence Integration

### 8.1 AI Code Assistance Architecture

The system integrates Google Generative AI (Gemini) for intelligent code assistance:

```
AI Interaction Flow:

1. User Submits Query
   │
   ├─→ POST /api/ai/code-help
   │   ├─→ Context Assembly
   │   │   ├─→ Current File Content
   │   │   ├─→ Selected Code Fragment
   │   │   ├─→ Project File Tree
   │   │   └─→ Conversation History
   │   │
   │   └─→ Prompt Construction
   │
2. AI Model Invocation
   │
   ├─→ Model: gemini-1.5-pro
   ├─→ Temperature: 0.7
   ├─→ Max Tokens: 8192
   └─→ Streaming Response: Enabled

3. Response Processing
   │
   ├─→ Parse AI Output
   ├─→ Extract Code Blocks
   ├─→ Format Markdown
   └─→ Stream to Client

4. Code Application
   │
   ├─→ User Accepts Suggestion
   ├─→ Generate Diff Preview
   ├─→ Apply Changes to File
   └─→ Trigger Auto-save
```

### 8.2 Context-Aware Assistance

The AI system maintains contextual awareness through:

- Current file analysis for targeted suggestions
- Project structure understanding for architectural recommendations
- Code pattern recognition for consistency maintenance
- Error detection and debugging assistance

## 9. Security Mechanisms

### 9.1 Authentication and Authorization

```
Security Layer Implementation:

1. Password Security
   ├─→ Hashing Algorithm: bcrypt
   ├─→ Salt Rounds: 10
   └─→ No Plain-text Storage

2. Session Management
   ├─→ JWT Token Generation
   │   ├─→ Expiration: 30 days
   │   ├─→ HTTP-only Cookie
   │   └─→ Secure Flag (Production)
   │
   └─→ Token Validation Middleware
       ├─→ Verify Signature
       ├─→ Check Expiration
       └─→ Extract User Context

3. Route Protection
   ├─→ Public Routes: /, /login, /register
   ├─→ Protected Routes: /dashboard/*, /ide/*
   └─→ Redirect Unauthenticated: /login
```

### 9.2 Container Isolation Security

Container security measures include:

- Process-level isolation through Docker namespaces
- Network segmentation preventing inter-container communication
- Resource limits preventing denial-of-service scenarios
- Filesystem isolation ensuring project separation
- Credential management through environment variables

### 9.3 API Security

```
Request Validation Pipeline:

1. Authentication Layer
   ├─→ Validate Session Token
   └─→ Identify User Context

2. Authorization Layer
   ├─→ Verify Resource Ownership
   │   └─→ Project belongs to User
   └─→ Check Operation Permissions

3. Input Validation
   ├─→ Sanitize File Paths
   ├─→ Validate Command Parameters
   └─→ Prevent Injection Attacks

4. Rate Limiting (Future Enhancement)
   ├─→ Request Throttling
   └─→ Abuse Prevention
```

## 10. Performance Optimization Strategies

### 10.1 WebSocket vs HTTP Polling Comparison

The system transitioned from HTTP polling to WebSocket for significant performance improvements:

```
HTTP Polling Approach:
  ├─→ Request Frequency: Every 3 seconds
  ├─→ Requests per Hour: 1200
  ├─→ Overhead: HTTP headers per request
  └─→ Latency: 1-3 seconds per update

WebSocket Approach:
  ├─→ Connection: Single persistent connection
  ├─→ Requests per Hour: 1 initial + events
  ├─→ Overhead: Minimal frame headers
  └─→ Latency: Real-time (milliseconds)

Performance Gain: 99.9% reduction in request volume
```

### 10.2 Caching Strategies

The system implements multiple caching layers:

- Port information caching to prevent redundant container inspections
- File tree caching to reduce filesystem traversal operations
- Container metadata caching for improved response times

### 10.3 Resource Management

```
Container Lifecycle Optimization:

1. Lazy Container Creation
   ├─→ Create on-demand when accessing project
   └─→ Avoid pre-allocated resource waste

2. Automatic Cleanup
   ├─→ Stop containers on user logout
   ├─→ Remove stopped containers after duration
   └─→ Reclaim system resources

3. Resource Monitoring
   ├─→ Track container resource usage
   ├─→ Implement usage quotas
   └─→ Alert on threshold breaches
```

## 11. System Deployment

### 11.1 Development Environment Setup

```bash
# Prerequisites
- Node.js 20.x or higher
- Docker Engine 24.x or higher
- PostgreSQL 15.x or higher
- Git version control

# Installation Steps
git clone https://github.com/kumar-ankit-100/QuantumIDE.git
cd QuantumIDE

# Install Dependencies
npm install

# Database Setup
npx prisma generate
npx prisma migrate dev

# Environment Configuration
cp .env.example .env.local
# Configure: DATABASE_URL, NEXTAUTH_SECRET, GITHUB_TOKEN

# Start Development Server
npm run dev
```

### 11.2 Production Deployment Considerations

```
Production Configuration:

1. Environment Variables
   ├─→ DATABASE_URL: Production PostgreSQL connection
   ├─→ NEXTAUTH_SECRET: Cryptographically secure secret
   ├─→ NEXTAUTH_URL: Public domain URL
   └─→ GITHUB_TOKEN: Personal access token with repo scope

2. Docker Configuration
   ├─→ Increase ulimit for concurrent containers
   ├─→ Configure resource constraints
   └─→ Enable Docker daemon logging

3. Reverse Proxy Setup
   ├─→ Nginx for HTTP/HTTPS termination
   ├─→ WebSocket proxy configuration
   └─→ SSL certificate installation

4. Process Management
   ├─→ PM2 or systemd for service supervision
   ├─→ Automatic restart on failure
   └─→ Log aggregation and monitoring
```

## 12. API Reference

### 12.1 Authentication Endpoints

```
POST /api/auth/signin
  Request: { email, password }
  Response: { user, token }
  
POST /api/auth/signup
  Request: { name, email, password }
  Response: { user, token }

GET /api/auth/session
  Response: { user, expires }
```

### 12.2 Project Management Endpoints

```
POST /api/projects/create
  Request: { name, description, template, createGithubRepo }
  Response: { projectId, containerId, previewUrl }

GET /api/projects/list
  Response: { projects: [...] }

DELETE /api/projects/[id]
  Response: { success: boolean }

POST /api/projects/[id]/resume
  Response: { containerId, status }

POST /api/projects/[id]/cleanup
  Response: { success: boolean }
```

### 12.3 File Operation Endpoints

```
POST /api/projects/[id]/files/tree
  Response: { files: [...] }

POST /api/projects/[id]/files/read
  Request: { filePath }
  Response: { content }

POST /api/projects/[id]/files/write
  Request: { filePath, content }
  Response: { success: boolean }

POST /api/projects/[id]/files/create
  Request: { path, type: 'file' | 'directory' }
  Response: { success: boolean }
```

### 12.4 Container Management Endpoints

```
POST /api/projects/[id]/terminal
  Response: Stream (bidirectional)

GET /api/projects/[id]/port
  Response: { previewUrl, hostPort, internalPort }

POST /api/projects/[id]/start-background
  Request: { command }
  Response: { success: boolean }

POST /api/projects/[id]/kill-process
  Request: { processName }
  Response: { success: boolean }
```

## 13. Error Handling and Logging

### 13.1 Error Classification

The system categorizes errors into distinct classes:

- Authentication Errors: Invalid credentials, expired sessions
- Authorization Errors: Insufficient permissions, ownership violations
- Container Errors: Docker daemon failures, resource constraints
- Network Errors: Port conflicts, connection timeouts
- Filesystem Errors: Permission denied, disk space exceeded

### 13.2 Logging Strategy

```
Log Levels and Usage:

INFO: Normal operations
  ├─→ Container creation
  ├─→ User authentication
  └─→ Project operations

WARN: Recoverable issues
  ├─→ Container recreation needed
  ├─→ Port detection delays
  └─→ Temporary network failures

ERROR: Critical failures
  ├─→ Database connection loss
  ├─→ Docker daemon unreachable
  └─→ Unhandled exceptions

DEBUG: Development diagnostics
  ├─→ WebSocket message flow
  ├─→ Container command execution
  └─→ File operation traces
```

## 14. Future Enhancements

### 14.1 Planned Features

- Multi-user real-time collaboration with operational transforms
- Integrated debugger with breakpoint support
- Custom Docker image support for additional languages
- Kubernetes integration for horizontal scaling
- Advanced analytics and usage metrics dashboard
- Mobile-responsive interface optimization

### 14.2 Scalability Considerations

```
Horizontal Scaling Strategy:

1. Application Layer
   ├─→ Stateless Next.js instances
   ├─→ Load balancer distribution
   └─→ Session storage in Redis

2. Container Layer
   ├─→ Multiple Docker hosts
   ├─→ Container orchestration
   └─→ Cross-host networking

3. Database Layer
   ├─→ Read replicas for queries
   ├─→ Write master for mutations
   └─→ Connection pooling
```

## 15. Conclusion

QuantumIDE represents a comprehensive solution for cloud-based software development, leveraging modern containerization technologies to provide isolated, secure, and performant development environments. The architecture emphasizes modularity, scalability, and user experience while maintaining strong security boundaries through Docker isolation. The integration of real-time communication, version control, and artificial intelligence assistance creates a cohesive development platform suitable for individual developers and collaborative teams.

The system demonstrates successful implementation of complex distributed system principles including container orchestration, real-time bidirectional communication, and secure multi-tenancy. Future development will focus on enhanced collaboration features and improved scalability to support growing user bases.

## 16. References

- Docker Documentation: Container isolation and API reference
- Next.js Documentation: Server-side rendering and API routes
- WebSocket Protocol Specification: RFC 6455
- Prisma Documentation: Type-safe database access
- GitHub REST API: Version control integration
- React Documentation: Component architecture patterns

## 17. Appendices

### Appendix A: Environment Variables

```
DATABASE_URL="postgresql://user:password@localhost:5432/quantumide"
NEXTAUTH_SECRET="cryptographic-random-string"
NEXTAUTH_URL="http://localhost:3001"
GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
GOOGLE_API_KEY="AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### Appendix B: System Requirements

```
Minimum Server Specifications:
- CPU: 4 cores
- RAM: 8 GB
- Storage: 100 GB SSD
- Network: 100 Mbps
- OS: Ubuntu 22.04 LTS or compatible

Recommended Specifications:
- CPU: 8+ cores
- RAM: 16+ GB
- Storage: 500+ GB NVMe SSD
- Network: 1 Gbps
- OS: Ubuntu 22.04 LTS
```

### Appendix C: License Information

This project is developed as an educational and research initiative. All rights reserved.
