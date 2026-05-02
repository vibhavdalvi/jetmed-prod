import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { IJwtPayload, UserRole } from '../types/index.js';
import { UnauthorizedError, ForbiddenError } from './errorHandler.js';
import User from '../models/User.js';
import { cacheGet, cacheSet } from '../config/redis.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: IJwtPayload;
    }
  }
}

// Verify JWT token
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from header or cookie
    let token: string | undefined;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw new UnauthorizedError('No authentication token provided');
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret) as IJwtPayload;

    // Check if user exists and is active (with caching)
    const cacheKey = `user:${decoded.userId}:active`;
    let isActive = await cacheGet(cacheKey);

    if (isActive === null) {
      const user = await User.findById(decoded.userId).select('isActive').lean();

      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      isActive = user.isActive ? 'true' : 'false';
      await cacheSet(cacheKey, isActive, 300); // Cache for 5 minutes
    }

    if (isActive === 'false') {
      throw new UnauthorizedError('User account is deactivated');
    }

    // Attach user to request
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else {
      next(error);
    }
  }
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret) as IJwtPayload;
      req.user = decoded;
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Role-based authorization
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError('You do not have permission to perform this action')
      );
    }

    next();
  };
};

// Check if user is admin (any admin role)
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const adminRoles: UserRole[] = [
    UserRole.ADMIN_SUPER,
    UserRole.ADMIN_OPERATIONS,
    UserRole.ADMIN_FINANCE,
    UserRole.ADMIN_CONTENT,
    UserRole.ADMIN_SUPPORT,
  ];

  if (!adminRoles.includes(req.user.role)) {
    return next(new ForbiddenError('Admin access required'));
  }

  next();
};

// Check if user is pharmacist
export const isPharmacist = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const pharmacistRoles: UserRole[] = [
    UserRole.PHARMACIST,
    UserRole.SENIOR_PHARMACIST,
  ];

  if (!pharmacistRoles.includes(req.user.role)) {
    return next(new ForbiddenError('Pharmacist access required'));
  }

  next();
};

// Check if user is delivery partner
export const isDeliveryPartner = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (req.user.role !== UserRole.DELIVERY_PARTNER) {
    return next(new ForbiddenError('Delivery partner access required'));
  }

  next();
};

// Check if user is warehouse staff
export const isWarehouseStaff = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (req.user.role !== UserRole.WAREHOUSE_STAFF) {
    return next(new ForbiddenError('Warehouse staff access required'));
  }

  next();
};

// Check if user owns the resource or is admin
export const isOwnerOrAdmin = (userIdField: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const resourceUserId = req.params[userIdField] || req.body[userIdField];
    const isOwner = req.user.userId === resourceUserId;

    const adminRoles: UserRole[] = [
      UserRole.ADMIN_SUPER,
      UserRole.ADMIN_OPERATIONS,
      UserRole.ADMIN_SUPPORT,
    ];
    const isAdminUser = adminRoles.includes(req.user.role);

    if (!isOwner && !isAdminUser) {
      return next(new ForbiddenError('Access denied'));
    }

    next();
  };
};

// 2FA verification middleware
export const require2FA = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  // Check if user has 2FA enabled
  const user = await User.findById(req.user.userId).select('twoFactorEnabled').lean();

  if (!user) {
    return next(new UnauthorizedError('User not found'));
  }

  // If 2FA is enabled, check if this session has verified 2FA
  if (user.twoFactorEnabled) {
    const twoFactorVerified = req.cookies?.twoFactorVerified;
    if (!twoFactorVerified) {
      return next(new ForbiddenError('Two-factor authentication required'));
    }
  }

  next();
};

// Staff-only access (all staff roles)
export const isStaff = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const staffRoles: UserRole[] = [
    UserRole.PHARMACIST,
    UserRole.SENIOR_PHARMACIST,
    UserRole.DELIVERY_PARTNER,
    UserRole.WAREHOUSE_STAFF,
    UserRole.SUPPORT_AGENT,
    UserRole.ADMIN_SUPER,
    UserRole.ADMIN_OPERATIONS,
    UserRole.ADMIN_FINANCE,
    UserRole.ADMIN_CONTENT,
    UserRole.ADMIN_SUPPORT,
  ];

  if (!staffRoles.includes(req.user.role)) {
    return next(new ForbiddenError('Staff access required'));
  }

  next();
};
