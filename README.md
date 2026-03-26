# CRM Backend

## Setup

1. Install dependencies:
```bash
cd crm-backend
npm install
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Edit `.env` with your database credentials

4. Run migration:
```bash
npm run migrate
```

5. Start server:
```bash
npm run dev
```

## API Endpoints

### Authentication
- POST /api/auth/register - Register new user
- POST /api/auth/login - Login
- GET /api/auth/me - Get current user

### Companies
- GET /api/companies - List companies
- GET /api/companies/:id - Get company
- POST /api/companies - Create company
- PUT /api/companies/:id - Update company
- DELETE /api/companies/:id - Delete company

### Contacts
- GET /api/contacts - List contacts
- GET /api/contacts/:id - Get contact
- POST /api/contacts - Create contact
- PUT /api/contacts/:id - Update contact
- DELETE /api/contacts/:id - Delete contact

### Deals
- GET /api/deals - List deals
- GET /api/deals/:id - Get deal
- POST /api/deals - Create deal
- PUT /api/deals/:id - Update deal
- DELETE /api/deals/:id - Delete deal
- PUT /api/deals/:id/products - Update deal products

### Tasks
- GET /api/tasks - List tasks
- GET /api/tasks/:id - Get task
- POST /api/tasks - Create task
- PUT /api/tasks/:id - Update task
- PATCH /api/tasks/:id/complete - Complete task
- DELETE /api/tasks/:id - Delete task

### Products
- GET /api/products - List products
- POST /api/products - Create product
- PUT /api/products/:id - Update product
- DELETE /api/products/:id - Delete product

### Interactions
- GET /api/interactions - List interactions
- POST /api/interactions - Create interaction
- PUT /api/interactions/:id - Update interaction
- DELETE /api/interactions/:id - Delete interaction

### Search
- GET /api/search?q=query - Search companies, contacts, deals

## Authentication

Most endpoints require authentication. Include the JWT token in the header:
```
Authorization: Bearer <token>
```

## Query Parameters

### Companies
- ?metro=austin - Filter by metro area
- ?search=term - Search by name/address

### Contacts
- ?company_id=uuid - Filter by company
- ?search=term - Search by name/email

### Deals
- ?company_id=uuid - Filter by company
- ?stage=prospect - Filter by stage
- ?status=active - Filter by status
- ?min_value=1000 - Minimum deal value
- ?max_value=50000 - Maximum deal value

### Tasks
- ?user_id=uuid - Filter by user
- ?completed=true/false - Filter by completion
- ?due_today=true - Tasks due today
- ?overdue=true - Overdue tasks

### Interactions
- ?company_id=uuid - Filter by company
- ?type=meeting - Filter by type
