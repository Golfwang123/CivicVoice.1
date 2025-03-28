import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateEmailTemplate, regenerateEmailWithTone } from "./openai";
import { sendEmail, normalizeEmail } from "./email";
import { insertProjectSchema, insertEmailSchema, insertUpvoteSchema, insertCommentSchema } from "@shared/schema";
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
      const { 
        issueType, 
        location, 
        description, 
        urgencyLevel,
        // Optional customization fields
        impactDescription,
        affectedGroups,
        desiredOutcome,
        proposedSolution
      } = req.body;
      
      if (!issueType || !location || !description || !urgencyLevel) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Create enhanced description if additional details are provided
      let enhancedDescription = description;
      
      if (impactDescription) {
        enhancedDescription += `\n\nImpact: ${impactDescription}`;
      }
      
      if (affectedGroups) {
        // Convert snake_case to readable text
        const groupName = affectedGroups
          .split('_')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        enhancedDescription += `\n\nAffected Groups: ${groupName}`;
      }
      
      if (desiredOutcome) {
        // Convert snake_case to readable text
        const outcome = desiredOutcome
          .split('_')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        enhancedDescription += `\n\nDesired Outcome: ${outcome}`;
      }
      
      if (proposedSolution) {
        enhancedDescription += `\n\nProposed Solution: ${proposedSolution}`;
      }
      
      const emailTemplate = await generateEmailTemplate(
        issueType,
        location,
        enhancedDescription,
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
      
      const result = await regenerateEmailWithTone(emailBody, tone);
      
      // If there's an error message but we still have an email body, return a 200 with both
      if (result.error && result.emailBody) {
        return res.json({ 
          emailBody: result.emailBody,
          warning: result.error 
        });
      }
      
      res.json({ emailBody: result.emailBody });
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
      
      // Prepare photo attachment if available
      let attachments = [];
      if (project.photoData) {
        // Extract the base64 data (remove the data URL prefix)
        const matches = project.photoData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        
        if (matches && matches.length === 3) {
          const contentType = matches[1];
          const imageData = matches[2];
          
          // Determine file extension based on content type
          let fileExtension = 'jpg';
          if (contentType.includes('png')) fileExtension = 'png';
          else if (contentType.includes('gif')) fileExtension = 'gif';
          
          attachments.push({
            filename: `issue-photo.${fileExtension}`,
            content: Buffer.from(imageData, 'base64'),
            contentType,
            encoding: 'base64'
          });
        }
      }
      
      // Use the sender's email if provided, otherwise use a default
      const from = normalizeEmail(validatedData.senderEmail) || "noreply@civicvoice.org";
      // Make sure senderName is a string if present, otherwise undefined
      const senderName = validatedData.senderName ? String(validatedData.senderName) : undefined;
      
      const result = await sendEmail({
        from,
        to: project.emailRecipient,
        subject: project.emailSubject,
        text: emailContent,
        senderName,
        attachments
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
  
  // Get comments for a project
  app.get("/api/projects/:id/comments", async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.id);
      
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }
      
      const project = await storage.getProjectById(projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const comments = await storage.getCommentsByProject(projectId);
      res.json(comments);
    } catch (error) {
      console.error("Error getting comments:", error);
      res.status(500).json({ message: "Failed to get comments" });
    }
  });
  
  // Create a comment for a project
  app.post("/api/projects/:id/comments", async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.id);
      
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }
      
      const project = await storage.getProjectById(projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Merge the projectId from the URL with the request body
      const commentData = insertCommentSchema.parse({
        ...req.body,
        projectId
      });
      
      const comment = await storage.createComment(commentData);
      res.status(201).json(comment);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      console.error("Error creating comment:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  return httpServer;
}
