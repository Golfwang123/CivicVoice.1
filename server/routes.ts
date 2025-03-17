import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateEmailTemplate, regenerateEmailWithTone } from "./openai";
import { sendEmail, normalizeEmail } from "./email";
import { insertProjectSchema, insertEmailSchema, insertUpvoteSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Get all projects with optional filters
  app.get("/api/projects", async (req: Request, res: Response) => {
    try {
      const { issueType, status, search } = req.query;
      
      let projects;
      
      if (search && typeof search === "string") {
        projects = await storage.searchProjects(search);
      } else if (issueType && typeof issueType === "string") {
        projects = await storage.getProjectsByType(issueType);
      } else if (status && typeof status === "string") {
        projects = await storage.getProjectsByStatus(status);
      } else {
        projects = await storage.getAllProjects();
      }
      
      res.json(projects);
    } catch (error) {
      console.error("Error getting projects:", error);
      res.status(500).json({ message: "Failed to get projects" });
    }
  });
  
  // Get a single project by ID
  app.get("/api/projects/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }
      
      const project = await storage.getProjectById(id);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      res.json(project);
    } catch (error) {
      console.error("Error getting project:", error);
      res.status(500).json({ message: "Failed to get project" });
    }
  });
  
  // Create a new project
  app.post("/api/projects", async (req: Request, res: Response) => {
    try {
      // Validate request body against schema
      const validatedData = insertProjectSchema.parse(req.body);
      
      // Create the project
      const project = await storage.createProject(validatedData);
      
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });
  
  // Generate email template for a given issue
  app.post("/api/generate-email", async (req: Request, res: Response) => {
    try {
      const { issueType, location, description, urgencyLevel } = req.body;
      
      if (!issueType || !location || !description || !urgencyLevel) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const emailTemplate = await generateEmailTemplate(
        issueType,
        location,
        description,
        urgencyLevel
      );
      
      res.json(emailTemplate);
    } catch (error) {
      console.error("Error generating email:", error);
      res.status(500).json({ message: "Failed to generate email template" });
    }
  });

  // Regenerate email with a different tone
  app.post("/api/regenerate-email", async (req: Request, res: Response) => {
    try {
      const { emailBody, tone } = req.body;
      
      if (!emailBody || !tone) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const regeneratedEmail = await regenerateEmailWithTone(emailBody, tone);
      
      res.json({ emailBody: regeneratedEmail });
    } catch (error) {
      console.error("Error regenerating email:", error);
      res.status(500).json({ message: "Failed to regenerate email" });
    }
  });
  
  // Send an email
  app.post("/api/send-email", async (req: Request, res: Response) => {
    try {
      const validatedData = insertEmailSchema.parse(req.body);
      
      // Get the project to which this email relates
      const project = await storage.getProjectById(validatedData.projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Send the email
      const emailContent = validatedData.customContent || project.emailTemplate;
      
      // Use the sender's email if provided, otherwise use a default
      const from = normalizeEmail(validatedData.senderEmail) || "noreply@civicvoice.org";
      
      const result = await sendEmail({
        from,
        to: project.emailRecipient,
        subject: project.emailSubject,
        text: emailContent,
        senderName: validatedData.senderName
      });
      
      if (!result.success) {
        return res.status(500).json({ message: result.message });
      }
      
      // Record the email in the database
      const email = await storage.createEmail(validatedData);
      
      res.status(201).json(email);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      console.error("Error sending email:", error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });
  
  // Upvote a project
  app.post("/api/projects/:id/upvote", async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.id);
      
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }
      
      const project = await storage.getProjectById(projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Use IP address to prevent duplicate upvotes
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      
      // Check if this IP has already upvoted this project
      const hasUpvoted = await storage.hasUserUpvoted(projectId, ipAddress);
      
      if (hasUpvoted) {
        return res.status(400).json({ message: "You have already upvoted this project" });
      }
      
      // Create the upvote
      const upvoteData = insertUpvoteSchema.parse({
        projectId,
        ipAddress,
        userId: null // For anonymous upvotes
      });
      
      const upvote = await storage.createUpvote(upvoteData);
      
      // Get the updated project
      const updatedProject = await storage.getProjectById(projectId);
      
      res.json(updatedProject);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      console.error("Error upvoting project:", error);
      res.status(500).json({ message: "Failed to upvote project" });
    }
  });
  
  // Get community statistics
  app.get("/api/stats", async (req: Request, res: Response) => {
    try {
      const stats = await storage.getCommunityStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting stats:", error);
      res.status(500).json({ message: "Failed to get community statistics" });
    }
  });
  
  // Get recent activities
  app.get("/api/activities", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const activities = await storage.getRecentActivities(limit);
      res.json(activities);
    } catch (error) {
      console.error("Error getting activities:", error);
      res.status(500).json({ message: "Failed to get activities" });
    }
  });

  return httpServer;
}
