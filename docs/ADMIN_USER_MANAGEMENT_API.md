# Admin User Management API Documentation

## Base URL

```
/api/admin/users
```

## Authentication

All endpoints require:

- Valid JWT token in Authorization header: `Bearer <token>`
- User role must be `admin`

---

## Endpoints

### 1. Get All Users

Get a paginated list of all users with filtering and sorting options.

**Endpoint:** `GET /api/admin/users`

**Query Parameters:**

- `page` (number, default: 1) - Page number
- `limit` (number, default: 10) - Items per page
- `search` (string) - Search by name, email, or username
- `role` (string) - Filter by role (user, admin)
- `status` (string) - Filter by status (active, inactive)
- `sortBy` (string, default: createdAt) - Sort field
- `order` (string, default: desc) - Sort order (asc, desc)

**Response:**

```json
{
	"success": true,
	"data": {
		"users": [
			{
				"_id": "user_id",
				"name": "John Doe",
				"email": "john@example.com",
				"userName": "johndoe",
				"role": "user",
				"isActive": true,
				"createdAt": "2024-01-01T00:00:00.000Z",
				"stats": {
					"questionsAttempted": 10,
					"questionsCompleted": 5
				}
			}
		],
		"pagination": {
			"page": 1,
			"limit": 10,
			"total": 100,
			"pages": 10
		}
	}
}
```

---

### 2. Get User Statistics

Get overall user statistics and recent users.

**Endpoint:** `GET /api/admin/users/stats`

**Response:**

```json
{
	"success": true,
	"data": {
		"stats": {
			"total": 1000,
			"active": 950,
			"inactive": 50,
			"admins": 5,
			"regular": 995,
			"newUsersLast30Days": 50
		},
		"recentUsers": [
			{
				"_id": "user_id",
				"name": "Jane Doe",
				"email": "jane@example.com",
				"userName": "janedoe",
				"role": "user",
				"createdAt": "2024-01-15T00:00:00.000Z"
			}
		]
	}
}
```

---

### 3. Get User by ID

Get detailed information about a specific user.

**Endpoint:** `GET /api/admin/users/:id`

**Response:**

```json
{
	"success": true,
	"data": {
		"user": {
			"_id": "user_id",
			"name": "John Doe",
			"email": "john@example.com",
			"userName": "johndoe",
			"role": "user",
			"bio": "Software developer",
			"location": "New York",
			"website": "https://johndoe.com",
			"isActive": true,
			"achievements": [],
			"stats": {
				"questionsAttempted": 10,
				"questionsCompleted": 5
			},
			"createdAt": "2024-01-01T00:00:00.000Z",
			"updatedAt": "2024-01-15T00:00:00.000Z"
		}
	}
}
```

---

### 4. Create User

Create a new user account.

**Endpoint:** `POST /api/admin/users`

**Request Body:**

```json
{
	"name": "John Doe",
	"email": "john@example.com",
	"userName": "johndoe",
	"password": "password123",
	"role": "user",
	"bio": "Software developer"
}
```

**Validation Rules:**

- `name`: Required, non-empty string
- `email`: Required, valid email format
- `userName`: Required, 3-20 characters, alphanumeric and underscores only
- `password`: Required, minimum 6 characters
- `role`: Optional, must be "user" or "admin" (default: "user")
- `bio`: Optional string

**Response:**

```json
{
	"success": true,
	"message": "User created successfully",
	"data": {
		"user": {
			"_id": "new_user_id",
			"name": "John Doe",
			"email": "john@example.com",
			"userName": "johndoe",
			"role": "user",
			"isActive": true,
			"createdAt": "2024-01-15T00:00:00.000Z"
		}
	}
}
```

---

### 5. Update User

Update user information.

**Endpoint:** `PUT /api/admin/users/:id`

**Request Body:**

```json
{
	"name": "John Updated",
	"email": "john.updated@example.com",
	"userName": "johnupdated",
	"role": "admin",
	"bio": "Senior developer",
	"location": "San Francisco",
	"website": "https://johnupdated.com",
	"isActive": true
}
```

**Notes:**

- All fields are optional
- Admin cannot change their own role
- Email and username must be unique

**Response:**

```json
{
	"success": true,
	"message": "User updated successfully",
	"data": {
		"user": {
			"_id": "user_id",
			"name": "John Updated",
			"email": "john.updated@example.com",
			"role": "admin",
			"updatedAt": "2024-01-15T00:00:00.000Z"
		}
	}
}
```

---

### 6. Delete User

Delete a user account.

**Endpoint:** `DELETE /api/admin/users/:id`

**Notes:**

- Admin cannot delete their own account
- This action is permanent

**Response:**

```json
{
	"success": true,
	"message": "User deleted successfully"
}
```

---

### 7. Reset User Password

Reset a user's password.

**Endpoint:** `PUT /api/admin/users/:id/reset-password`

**Request Body:**

```json
{
	"newPassword": "newpassword123"
}
```

**Validation:**

- `newPassword`: Required, minimum 6 characters

**Response:**

```json
{
	"success": true,
	"message": "Password reset successfully"
}
```

---

### 8. Toggle User Status

Activate or deactivate a user account.

**Endpoint:** `PATCH /api/admin/users/:id/toggle-status`

**Notes:**

- Admin cannot deactivate their own account
- Toggles between active and inactive status

**Response:**

```json
{
	"success": true,
	"message": "User activated successfully",
	"data": {
		"isActive": true
	}
}
```

---

### 9. Bulk Delete Users

Delete multiple users at once.

**Endpoint:** `POST /api/admin/users/bulk-delete`

**Request Body:**

```json
{
	"userIds": ["user_id_1", "user_id_2", "user_id_3"]
}
```

**Notes:**

- Admin cannot delete their own account
- Provide an array of user IDs

**Response:**

```json
{
	"success": true,
	"message": "3 users deleted successfully",
	"data": {
		"deletedCount": 3
	}
}
```

---

## Error Responses

### 400 Bad Request

```json
{
	"success": false,
	"message": "Validation failed",
	"errors": [
		{
			"field": "email",
			"message": "Please provide a valid email"
		}
	]
}
```

### 401 Unauthorized

```json
{
	"success": false,
	"message": "Authorization denied. No token provided."
}
```

### 403 Forbidden

```json
{
	"success": false,
	"message": "Access denied. Admins only."
}
```

### 404 Not Found

```json
{
	"success": false,
	"message": "User not found."
}
```

### 500 Internal Server Error

```json
{
	"success": false,
	"message": "An unexpected error occurred. Please try again later."
}
```

---

## Usage Examples

### Get All Users with Filters

```bash
GET /api/admin/users?page=1&limit=20&search=john&role=user&status=active&sortBy=createdAt&order=desc
Authorization: Bearer <admin_token>
```

### Create a New User

```bash
POST /api/admin/users
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "New User",
  "email": "newuser@example.com",
  "userName": "newuser",
  "password": "password123",
  "role": "user"
}
```

### Update User Role

```bash
PUT /api/admin/users/user_id_here
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "role": "admin"
}
```

### Reset User Password

```bash
PUT /api/admin/users/user_id_here/reset-password
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "newPassword": "newpassword123"
}
```

### Toggle User Status

```bash
PATCH /api/admin/users/user_id_here/toggle-status
Authorization: Bearer <admin_token>
```

### Delete User

```bash
DELETE /api/admin/users/user_id_here
Authorization: Bearer <admin_token>
```

---

## Security Notes

1. All endpoints require admin authentication
2. Admins cannot:
   - Delete their own account
   - Deactivate their own account
   - Change their own role
3. Passwords are hashed using bcrypt
4. Rate limiting is applied to all endpoints
5. Input validation is performed on all requests
6. Sensitive data (passwords, tokens) are never returned in responses
