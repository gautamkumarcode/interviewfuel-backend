export const ERROR_MESSAGES = {
	USER_NOT_FOUND: "User not found.",
	VALIDATION_FAILED: "Validation failed.",
	INVALID_CREDENTIALS: "Invalid email or password.",
	EMAIL_ALREADY_EXISTS: "Email already exists.",
	USERNAME_ALREADY_EXISTS: "Username already exists.",
	INVALID_TOKEN: "Invalid token.",
	TOKEN_EXPIRED: "Token has expired.",
	ACCOUNT_DEACTIVATED: "Account is deactivated.",
	PASSWORD_TOO_SHORT: "Password must be at least 6 characters long.",
	INVALID_EMAIL: "Please provide a valid email address.",
	USERNAME_INVALID:
		"Username must be 3-20 characters and contain only letters, numbers, and underscores.",
	RESOURCE_NOT_FOUND: "Resource not found.",
	DUPLICATE_FIELD: "Duplicate field value entered.",
	VALIDATION_ERROR: "Validation error occurred.",
	SERVER_ERROR: "An unexpected error occurred. Please try again later.",
	AUTHORIZATION_DENIED: "Authorization denied. No token provided.",
	ACCOUNT_NOT_ACTIVE: "Your account is not active. Please contact support.",
	CURRENT_PASSWORD_REQUIRED: "Current password is required.",
	NEW_PASSWORD_REQUIRED: "New password is required.",
	PASSWORD_MISMATCH: "Current password does not match.",
	NAME_TOO_SHORT: "Name must be between 2 and 50 characters.",
	NAME_REQUIRED: "Name is required.",
	EMAIL_REQUIRED: "Email is required.",
	USERNAME_REQUIRED: "Username is required.",
	PASSWORD_REQUIRED: "Password is required.",
	INVALID_REQUEST: "Invalid request. Please check your input.",
	UNAUTHORIZED: "You are not authorized to perform this action.",
	FORBIDDEN: "You do not have permission to access this resource.",
	INTERNAL_SERVER_ERROR: "Internal server error. Please try again later.",
	NOT_FOUND: "The requested resource was not found.",
	BAD_REQUEST: "Bad request. Please check your input.",
	CONFLICT:
		"Conflict. The request could not be completed due to a conflict with the current state of the resource.",
	UNPROCESSABLE_ENTITY:
		"Unprocessable entity. The request was well-formed but was unable to be followed due to semantic errors.",
	TOO_MANY_REQUESTS: "Too many requests. Please try again later.",
	SERVICE_UNAVAILABLE: "Service unavailable. Please try again later.",
	GATEWAY_TIMEOUT:
		"Gateway timeout. The server did not receive a timely response from an upstream server.",
	NOT_IMPLEMENTED:
		"Not implemented. The requested functionality is not supported by the server.",
	BAD_GATEWAY:
		"Bad gateway. The server received an invalid response from an upstream server.",
	METHOD_NOT_ALLOWED:
		"Method not allowed. The requested method is not supported for the specified resource.",
	NOT_ACCEPTABLE:
		"Not acceptable. The requested resource is not available in a format that is acceptable to the client.",
	REQUEST_TIMEOUT:
		"Request timeout. The server timed out waiting for the request.",
	PAYLOAD_TOO_LARGE:
		"Payload too large. The request payload is larger than the server is willing or able to process.",
	UNSUPPORTED_MEDIA_TYPE:
		"Unsupported media type. The request entity has a media type which the server or resource does not support.",
	RANGE_NOT_SATISFIABLE:
		"Range not satisfiable. The requested range cannot be fulfilled.",
	EXPECTATION_FAILED:
		"Expectation failed. The server cannot meet the requirements of the Expect request-header field.",
};
