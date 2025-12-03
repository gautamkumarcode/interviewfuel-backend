# Admin User Management Setup Guide

## Overview

The admin user management system allows administrators to manage all users in the platform, including creating, updating, deleting users, and managing their roles and permissions.

## Features Implemented

### ✅ User Management

- **List Users**: Paginated list with search, filter, and sort
- **View User**: Detailed user information
- **Create User**: Create new user accounts
- **Update User**: Modify user information
- **Delete User**: Remove user accounts
- **Bulk Delete**: Delete multiple users at once

### ✅ User Status Management

- **Toggle Status**: Activate/deactivate user accounts
- **Reset Password**: Admin can reset any user's password

### ✅ Statistics & Analytics

- **User Stats**: Total, active, inactive, admin, regular users
- **Recent Users**: List of recently registered users
- **Growth Metrics**: New users in last 30 days

### ✅ Security Features

- Admin-only access (role-based authorization)
- Admins cannot delete/deactivate themselves
- Admins cannot change their own role
- Password hashing with bcrypt
- Input validation on all endpoints
- Rate limiting protection

## API Endpoints

All endpoints are prefixed with `/api/admin/users` and require admin authentication.

| Method | Endpoint              | Description               |
| ------ | --------------------- | ------------------------- |
| GET    | `/`                   | Get all users (paginated) |
| GET    | `/stats`              | Get user statistics       |
| GET    | `/:id`                | Get user by ID            |
| POST   | `/`                   | Create new user           |
| PUT    | `/:id`                | Update user               |
| DELETE | `/:id`                | Delete user               |
| PUT    | `/:id/reset-password` | Reset user password       |
| PATCH  | `/:id/toggle-status`  | Toggle user active status |
| POST   | `/bulk-delete`        | Delete multiple users     |

## Testing the Implementation

### 1. Start the Server

```bash
cd backend
npm run dev
```

### 2. Get Admin Token

First, login as an admin user to get the authentication token:

```bash
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "your_admin_password"
}
```

Save the `accessToken` from the response.

### 3. Test Admin Endpoints

#### Get All Users

```bash
GET http://localhost:5000/api/admin/users?page=1&limit=10
Authorization: Bearer YOUR_ADMIN_TOKEN
```

#### Get User Statistics

```bash
GET http://localhost:5000/api/admin/users/stats
Authorization: Bearer YOUR_ADMIN_TOKEN
```

#### Create a New User

```bash
POST http://localhost:5000/api/admin/users
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "name": "Test User",
  "email": "testuser@example.com",
  "userName": "testuser",
  "password": "password123",
  "role": "user"
}
```

#### Update User

```bash
PUT http://localhost:5000/api/admin/users/USER_ID
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "name": "Updated Name",
  "role": "admin"
}
```

#### Toggle User Status

```bash
PATCH http://localhost:5000/api/admin/users/USER_ID/toggle-status
Authorization: Bearer YOUR_ADMIN_TOKEN
```

#### Reset User Password

```bash
PUT http://localhost:5000/api/admin/users/USER_ID/reset-password
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "newPassword": "newpassword123"
}
```

#### Delete User

```bash
DELETE http://localhost:5000/api/admin/users/USER_ID
Authorization: Bearer YOUR_ADMIN_TOKEN
```

## Frontend Integration

### Example: Fetch All Users

```javascript
const fetchUsers = async (page = 1, limit = 10, filters = {}) => {
	const queryParams = new URLSearchParams({
		page,
		limit,
		...filters,
	});

	const response = await fetch(
		`http://localhost:5000/api/admin/users?${queryParams}`,
		{
			headers: {
				Authorization: `Bearer ${adminToken}`,
				"Content-Type": "application/json",
			},
		}
	);

	const data = await response.json();
	return data;
};
```

### Example: Create User

```javascript
const createUser = async (userData) => {
	const response = await fetch("http://localhost:5000/api/admin/users", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${adminToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(userData),
	});

	const data = await response.json();
	return data;
};
```

### Example: Update User

```javascript
const updateUser = async (userId, updates) => {
	const response = await fetch(
		`http://localhost:5000/api/admin/users/${userId}`,
		{
			method: "PUT",
			headers: {
				Authorization: `Bearer ${adminToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(updates),
		}
	);

	const data = await response.json();
	return data;
};
```

### Example: Delete User

```javascript
const deleteUser = async (userId) => {
	const response = await fetch(
		`http://localhost:5000/api/admin/users/${userId}`,
		{
			method: "DELETE",
			headers: {
				Authorization: `Bearer ${adminToken}`,
			},
		}
	);

	const data = await response.json();
	return data;
};
```

## React Component Example

```jsx
import { useState, useEffect } from "react";

function AdminUserManagement() {
	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);

	useEffect(() => {
		fetchUsers();
	}, [page]);

	const fetchUsers = async () => {
		setLoading(true);
		try {
			const response = await fetch(
				`http://localhost:5000/api/admin/users?page=${page}&limit=10`,
				{
					headers: {
						Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
					},
				}
			);
			const data = await response.json();

			if (data.success) {
				setUsers(data.data.users);
				setTotalPages(data.data.pagination.pages);
			}
		} catch (error) {
			console.error("Error fetching users:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleDeleteUser = async (userId) => {
		if (!confirm("Are you sure you want to delete this user?")) return;

		try {
			const response = await fetch(
				`http://localhost:5000/api/admin/users/${userId}`,
				{
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
					},
				}
			);
			const data = await response.json();

			if (data.success) {
				alert("User deleted successfully");
				fetchUsers(); // Refresh list
			}
		} catch (error) {
			console.error("Error deleting user:", error);
		}
	};

	const handleToggleStatus = async (userId) => {
		try {
			const response = await fetch(
				`http://localhost:5000/api/admin/users/${userId}/toggle-status`,
				{
					method: "PATCH",
					headers: {
						Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
					},
				}
			);
			const data = await response.json();

			if (data.success) {
				fetchUsers(); // Refresh list
			}
		} catch (error) {
			console.error("Error toggling status:", error);
		}
	};

	if (loading) return <div>Loading...</div>;

	return (
		<div>
			<h1>User Management</h1>
			<table>
				<thead>
					<tr>
						<th>Name</th>
						<th>Email</th>
						<th>Role</th>
						<th>Status</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{users.map((user) => (
						<tr key={user._id}>
							<td>{user.name}</td>
							<td>{user.email}</td>
							<td>{user.role}</td>
							<td>{user.isActive ? "Active" : "Inactive"}</td>
							<td>
								<button onClick={() => handleToggleStatus(user._id)}>
									{user.isActive ? "Deactivate" : "Activate"}
								</button>
								<button onClick={() => handleDeleteUser(user._id)}>
									Delete
								</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>

			<div>
				<button disabled={page === 1} onClick={() => setPage(page - 1)}>
					Previous
				</button>
				<span>
					Page {page} of {totalPages}
				</span>
				<button
					disabled={page === totalPages}
					onClick={() => setPage(page + 1)}>
					Next
				</button>
			</div>
		</div>
	);
}

export default AdminUserManagement;
```

## Security Considerations

1. **Authentication**: All endpoints require valid admin JWT token
2. **Authorization**: Only users with `role: "admin"` can access these endpoints
3. **Self-Protection**: Admins cannot delete/deactivate themselves or change their own role
4. **Password Security**: Passwords are hashed with bcrypt (12 rounds)
5. **Input Validation**: All inputs are validated using express-validator
6. **Rate Limiting**: API rate limiting is applied to prevent abuse
7. **Data Sanitization**: MongoDB injection protection with express-mongo-sanitize
8. **XSS Protection**: XSS clean middleware prevents cross-site scripting

## Troubleshooting

### Issue: 403 Forbidden

**Solution**: Ensure the user has admin role and valid token

### Issue: 400 Validation Failed

**Solution**: Check request body matches validation rules

### Issue: 404 User Not Found

**Solution**: Verify the user ID exists in the database

### Issue: Cannot delete/deactivate own account

**Solution**: This is by design for security. Use another admin account

## Next Steps

1. **Frontend Dashboard**: Create admin dashboard UI
2. **Advanced Filters**: Add more filtering options
3. **Export Users**: Add CSV/Excel export functionality
4. **User Activity Logs**: Track admin actions
5. **Email Notifications**: Notify users of account changes
6. **Bulk Operations**: Add more bulk operations (activate, update role, etc.)

## Files Created

- `backend/controller/admin-user-controller.js` - Admin user management controller
- `backend/routes/admin-users.js` - Admin user management routes
- `backend/docs/ADMIN_USER_MANAGEMENT_API.md` - API documentation
- `backend/docs/ADMIN_SETUP_GUIDE.md` - This setup guide

## Support

For issues or questions, refer to the API documentation or check the error messages returned by the API.
