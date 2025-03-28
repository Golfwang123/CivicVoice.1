import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { z } from 'zod';
import { fromZodError } from "zod-validation-error";
import jwt from 'jsonwebtoken';
import createMemoryStore from 'memorystore';

// Define types for Express session and Express.User
declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || randomBytes(32).toString('hex');
const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const TOKEN_EXPIRATION = '7d';

// Password hashing 
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${hash}.${salt}`;
}

export function comparePasswords(supplied: string, stored: string): boolean {
  const [hashedPassword, salt] = stored.split('.');
  const suppliedHash = scryptSync(supplied, salt, 64).toString('hex');
  
  // Use constant-time comparison to prevent timing attacks
  return timingSafeEqual(
    Buffer.from(hashedPassword, 'hex'),
    Buffer.from(suppliedHash, 'hex')
  );
}

// Validate login data
const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8)
});

// Setup auth middleware
export function setupAuth(app: Express) {
  // Initialize memory store for session storage
  const MemoryStore = createMemoryStore(session);
  
  // Session configuration
  const sessionOptions: session.SessionOptions = {
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false, 
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    },
    store: new MemoryStore({
      checkPeriod: 86400000 // Prune expired entries every 24h
    })
  };
  
  // Set up session middleware
  app.use(session(sessionOptions));
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Configure passport local strategy
  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return done(null, false, { message: "Incorrect username or password" });
      }
      
      if (!comparePasswords(password, user.password)) {
        return done(null, false, { message: "Incorrect username or password" });
      }
      
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }));
  
  // User serialization/deserialization for sessions
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
  
  // Authentication routes
  
  // Registration endpoint
  app.post("/api/register", async (req, res) => {
    try {
      const { username, email, password, fullName } = req.body;
      
      // Check if username already exists
      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username already taken" });
      }
      
      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already registered" });
      }
      
      // Hash password
      const hashedPassword = hashPassword(password);
      
      // Create user
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        fullName
      });
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      
      // Auto login after registration
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed after registration" });
        }
        return res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });
  
  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    try {
      // Validate login data
      loginSchema.parse(req.body);
      
      passport.authenticate("local", (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
        if (err) {
          return next(err);
        }
        
        if (!user) {
          return res.status(401).json({ message: info?.message || "Authentication failed" });
        }
        
        req.login(user, (err) => {
          if (err) {
            return next(err);
          }
          
          // Remove password from response
          const { password: _, ...userWithoutPassword } = user;
          
          // Generate JWT token for API access
          const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
          
          return res.json({ user: userWithoutPassword, token });
        });
      })(req, res, next);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      next(error);
    }
  });
  
  // Logout endpoint
  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.sendStatus(200);
    });
  });
  
  // Get current user
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });
  
  // Middleware to check if user is authenticated
  app.use("/api/protected/*", (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    next();
  });
  
  // JWT middleware for API token authentication
  app.use((req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      // No token provided, continue to session-based auth
      return next();
    }
    
    const token = authHeader.split(' ')[1]; // Bearer TOKEN
    
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      
      if (!payload || typeof payload !== 'object' || !('id' in payload)) {
        return res.status(403).json({ message: "Invalid token payload" });
      }
      
      // Using Promise and then() instead of await
      storage.getUser(payload.id as number)
        .then(user => {
          if (!user) {
            return res.status(403).json({ message: "User not found" });
          }
          
          req.user = user;
          next();
        })
        .catch(error => {
          console.error("Error fetching user:", error);
          res.status(500).json({ message: "Internal server error" });
        });
    } catch (err) {
      if (err instanceof jwt.JsonWebTokenError) {
        return res.status(403).json({ message: "Invalid or expired token" });
      }
      return res.status(500).json({ message: "Token verification failed" });
    }
  });
  
  // Create middleware for routes that require authentication
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };
  
  // Add the middleware for protected routes
  app.use("/api/protected", requireAuth);
}