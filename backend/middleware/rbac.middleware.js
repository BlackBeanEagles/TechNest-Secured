// Role-Based Access Control middleware
// Roles: 'admin', 'user'

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Access denied: insufficient permissions',
                required: allowedRoles,
                current: req.user.role
            });
        }
        next();
    };
}

const requireAdmin = requireRole('admin');
const requireUser  = requireRole('admin', 'user'); // admin can do everything users can

module.exports = { requireRole, requireAdmin, requireUser };
