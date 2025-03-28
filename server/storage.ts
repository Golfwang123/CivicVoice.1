import { 
  User, InsertUser, 
  Project, InsertProject, 
  Upvote, InsertUpvote, 
  Email, InsertEmail, 
  Activity, InsertActivity,
  Comment, InsertComment
} from "@shared/schema";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  
  // Project operations
  getAllProjects(): Promise<Project[]>;
  getProjectById(id: number): Promise<Project | undefined>;
  getProjectsByType(issueType: string): Promise<Project[]>;
  getProjectsByStatus(progressStatus: string): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, updates: Partial<Project>): Promise<Project | undefined>;
  
  // Upvote operations
  createUpvote(upvote: InsertUpvote): Promise<Upvote>;
  getUpvotesByProject(projectId: number): Promise<Upvote[]>;
  hasUserUpvoted(projectId: number, ipAddress: string): Promise<boolean>;
  
  // Email operations
  createEmail(email: InsertEmail): Promise<Email>;
  getEmailsByProject(projectId: number): Promise<Email[]>;
  
  // Activity operations
  createActivity(activity: InsertActivity): Promise<Activity>;
  getRecentActivities(limit: number): Promise<Activity[]>;
  getActivitiesByProject(projectId: number): Promise<Activity[]>;
  
  // Stats operations
  getCommunityStats(): Promise<{
    activeIssues: number;
    emailsSent: number;
    issuesResolved: number;
    successRate: number;
  }>;
  
  // Search and filter operations
  searchProjects(query: string): Promise<Project[]>;
  
  // Comment operations
  createComment(comment: InsertComment): Promise<Comment>;
  getCommentsByProject(projectId: number): Promise<Comment[]>;
}

// Memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private projects: Map<number, Project>;
  private upvotes: Map<number, Upvote>;
  private emails: Map<number, Email>;
  private activities: Map<number, Activity>;
  private comments: Map<number, Comment>;
  
  private userId: number;
  private projectId: number;
  private upvoteId: number;
  private emailId: number;
  private activityId: number;
  private commentId: number;
  
  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.upvotes = new Map();
    this.emails = new Map();
    this.activities = new Map();
    this.comments = new Map();
    
    this.userId = 1;
    this.projectId = 1;
    this.upvoteId = 1;
    this.emailId = 1;
    this.activityId = 1;
    this.commentId = 1;
    
    // Add some sample data
    this.addSampleData();
  }
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const now = new Date();
    
    const user: User = { 
      ...insertUser, 
      id,
      role: 'user',
      verified: false,
      verificationToken: null,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      fullName: insertUser.fullName || null,
      profilePicture: insertUser.profilePicture || null,
      createdAt: now,
      updatedAt: now
    };
    
    this.users.set(id, user);
    return user;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }
  
  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { 
      ...user, 
      ...updates,
      updatedAt: new Date()
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  // Project operations
  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort((a, b) => b.upvotes - a.upvotes);
  }
  
  async getProjectById(id: number): Promise<Project | undefined> {
    return this.projects.get(id);
  }
  
  async getProjectsByType(issueType: string): Promise<Project[]> {
    return Array.from(this.projects.values())
      .filter(project => project.issueType === issueType)
      .sort((a, b) => b.upvotes - a.upvotes);
  }
  
  async getProjectsByStatus(progressStatus: string): Promise<Project[]> {
    return Array.from(this.projects.values())
      .filter(project => project.progressStatus === progressStatus)
      .sort((a, b) => b.upvotes - a.upvotes);
  }
  
  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = this.projectId++;
    const project: Project = {
      ...insertProject,
      id,
      upvotes: 0,
      emailsSent: 0,
      progressStatus: 'idea_submitted',
      createdAt: new Date(),
      createdBy: insertProject.createdBy || null,
      urgencyLevel: insertProject.urgencyLevel || "medium",
      contactEmail: insertProject.contactEmail || null,
      photoUrl: insertProject.photoUrl || null,
      photoData: insertProject.photoData || null
    };
    
    this.projects.set(id, project);
    
    // Create an activity for this new project
    await this.createActivity({
      projectId: id,
      activityType: 'project_created',
      actorName: 'Anonymous User',
      description: `New issue submitted: ${project.title}`
    });
    
    return project;
  }
  
  async updateProject(id: number, updates: Partial<Project>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    
    // Type safety for progressStatus
    if (updates.progressStatus) {
      updates.progressStatus = updates.progressStatus as "idea_submitted" | "community_support" | "email_campaign_active" | "official_acknowledgment" | "planning_stage" | "implementation" | "completed";
    }
    
    const updatedProject = { ...project, ...updates };
    this.projects.set(id, updatedProject);
    
    // If progress status was updated, create an activity
    if (updates.progressStatus && updates.progressStatus !== project.progressStatus) {
      await this.createActivity({
        projectId: id,
        activityType: 'status_change',
        actorName: 'System',
        description: `Project status updated to: ${updates.progressStatus}`
      });
    }
    
    return updatedProject;
  }
  
  // Upvote operations
  async createUpvote(insertUpvote: InsertUpvote): Promise<Upvote> {
    const id = this.upvoteId++;
    const upvote: Upvote = {
      ...insertUpvote,
      id,
      createdAt: new Date(),
      userId: insertUpvote.userId || null
    };
    
    this.upvotes.set(id, upvote);
    
    // Increment upvote count for the project
    const project = this.projects.get(upvote.projectId);
    if (project) {
      await this.updateProject(project.id, { 
        upvotes: project.upvotes + 1,
        progressStatus: this.determineProgressStatus(project.upvotes + 1, project.emailsSent, project.progressStatus)
      });
      
      // Create an activity
      await this.createActivity({
        projectId: project.id,
        activityType: 'upvote',
        actorName: 'Anonymous User',
        description: `Someone upvoted: ${project.title}`
      });
    }
    
    return upvote;
  }
  
  async getUpvotesByProject(projectId: number): Promise<Upvote[]> {
    return Array.from(this.upvotes.values())
      .filter(upvote => upvote.projectId === projectId);
  }
  
  async hasUserUpvoted(projectId: number, ipAddress: string): Promise<boolean> {
    return Array.from(this.upvotes.values())
      .some(upvote => upvote.projectId === projectId && upvote.ipAddress === ipAddress);
  }
  
  // Email operations
  async createEmail(insertEmail: InsertEmail): Promise<Email> {
    const id = this.emailId++;
    const email: Email = {
      ...insertEmail,
      id,
      sentAt: new Date(),
      senderEmail: insertEmail.senderEmail || null,
      senderName: insertEmail.senderName || null,
      customContent: insertEmail.customContent || null
    };
    
    this.emails.set(id, email);
    
    // Increment email count for the project
    const project = this.projects.get(email.projectId);
    if (project) {
      await this.updateProject(project.id, { 
        emailsSent: project.emailsSent + 1,
        progressStatus: this.determineProgressStatus(project.upvotes, project.emailsSent + 1, project.progressStatus)
      });
      
      // Create an activity
      await this.createActivity({
        projectId: project.id,
        activityType: 'email_sent',
        actorName: email.senderName || 'Anonymous User',
        description: `Email sent regarding: ${project.title}`
      });
    }
    
    return email;
  }
  
  async getEmailsByProject(projectId: number): Promise<Email[]> {
    return Array.from(this.emails.values())
      .filter(email => email.projectId === projectId)
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  }
  
  // Activity operations
  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const id = this.activityId++;
    const activity: Activity = {
      ...insertActivity,
      id,
      createdAt: new Date(),
      actorName: insertActivity.actorName || null
    };
    
    this.activities.set(id, activity);
    return activity;
  }
  
  async getRecentActivities(limit: number): Promise<Activity[]> {
    return Array.from(this.activities.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
  
  async getActivitiesByProject(projectId: number): Promise<Activity[]> {
    return Array.from(this.activities.values())
      .filter(activity => activity.projectId === projectId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  // Stats operations
  async getCommunityStats(): Promise<{
    activeIssues: number;
    emailsSent: number;
    issuesResolved: number;
    successRate: number;
  }> {
    const projects = Array.from(this.projects.values());
    const activeIssues = projects.filter(p => p.progressStatus !== 'completed').length;
    const issuesResolved = projects.filter(p => p.progressStatus === 'completed').length;
    const totalIssues = projects.length;
    const totalEmails = Array.from(this.emails.values()).length;
    
    const successRate = totalIssues > 0 ? Math.round((issuesResolved / totalIssues) * 100) : 0;
    
    return {
      activeIssues,
      emailsSent: totalEmails,
      issuesResolved,
      successRate
    };
  }
  
  // Search and filter operations
  async searchProjects(query: string): Promise<Project[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.projects.values())
      .filter(project => 
        project.title.toLowerCase().includes(lowerQuery) || 
        project.description.toLowerCase().includes(lowerQuery) ||
        project.location.toLowerCase().includes(lowerQuery)
      )
      .sort((a, b) => b.upvotes - a.upvotes);
  }
  
  // Comment operations
  async createComment(insertComment: InsertComment): Promise<Comment> {
    const id = this.commentId++;
    const comment: Comment = {
      ...insertComment,
      id,
      createdAt: new Date()
    };
    
    this.comments.set(id, comment);
    
    // Create an activity for this new comment
    await this.createActivity({
      projectId: comment.projectId,
      activityType: 'comment_added',
      actorName: comment.commenterName,
      description: `New comment on project: ${this.projects.get(comment.projectId)?.title || 'Unknown Project'}`
    });
    
    return comment;
  }
  
  async getCommentsByProject(projectId: number): Promise<Comment[]> {
    return Array.from(this.comments.values())
      .filter(comment => comment.projectId === projectId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  // Helper method to determine progress status based on upvotes and emails
  private determineProgressStatus(
    upvotes: number, 
    emailsSent: number, 
    currentStatus: string
  ): "idea_submitted" | "community_support" | "email_campaign_active" | "official_acknowledgment" | "planning_stage" | "implementation" | "completed" {
    // Don't downgrade from these statuses
    if (['official_acknowledgment', 'planning_stage', 'implementation', 'completed'].includes(currentStatus)) {
      return currentStatus as "official_acknowledgment" | "planning_stage" | "implementation" | "completed";
    }
    
    if (emailsSent >= 50) {
      return 'email_campaign_active';
    } else if (upvotes >= 25) {
      return 'community_support';
    } else {
      return 'idea_submitted';
    }
  }
  
  // Add some sample data for development
  private addSampleData() {
    const project1: Project = {
      id: this.projectId++,
      title: "Crosswalk Needed at Lincoln & 5th Ave",
      description: "Dangerous intersection with high pedestrian traffic and no safe crossing.",
      issueType: "crosswalk",
      location: "Lincoln & 5th Ave",
      latitude: "37.7749",
      longitude: "-122.4194",
      urgencyLevel: "medium",
      contactEmail: "example@example.com",
      emailTemplate: "Dear Transportation Department,\n\nI am writing to request the installation of a crosswalk at the intersection of Lincoln Avenue and 5th Street. This intersection experiences high pedestrian traffic, particularly during rush hours, yet lacks a safe crossing option for pedestrians.\n\nAs a regular commuter through this area, I have witnessed several near-miss incidents between vehicles and pedestrians attempting to cross this busy intersection. The lack of a designated crosswalk creates a medium-urgency safety concern for our community members, especially children and elderly individuals who frequently use this route.\n\nThe installation of a crosswalk at this location would significantly improve pedestrian safety and traffic flow. Many residents in the surrounding neighborhoods would benefit from this infrastructure improvement, as it connects residential areas to local businesses and public transportation stops.\n\nI would appreciate your department's consideration of this request. Please feel free to contact me at the information provided below if you require any additional details or community input regarding this matter.\n\nThank you for your attention to this important safety concern.\n\nSincerely,\n[Your Name]\n[Optional Contact Information]",
      emailSubject: "Request for Crosswalk Installation at Lincoln & 5th Avenue",
      emailRecipient: "citytransportation@cityname.gov",
      upvotes: 45,
      emailsSent: 38,
      progressStatus: "community_support",
      photoUrl: null,
      photoData: null,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      createdBy: null
    };
    
    const project2: Project = {
      id: this.projectId++,
      title: "Broken Sidewalk on Oak Street",
      description: "Multiple large cracks making it difficult for wheelchair access.",
      issueType: "sidewalk",
      location: "Oak Street",
      latitude: "37.7746",
      longitude: "-122.4184",
      urgencyLevel: "low",
      contactEmail: null,
      emailTemplate: "Dear Public Works Department,\n\nI am writing to bring to your attention a sidewalk in serious disrepair on Oak Street between 10th and 11th Avenue. The sidewalk has multiple large cracks and uneven surfaces that create significant accessibility challenges.\n\nThis damaged sidewalk poses a particular hardship for individuals using wheelchairs, walkers, or strollers. I have personally observed wheelchair users having to navigate into the street to bypass the damaged section, creating unnecessary safety risks.\n\nRepairing this sidewalk would greatly improve accessibility in our neighborhood and demonstrate our city's commitment to providing safe infrastructure for all residents regardless of mobility needs.\n\nI would appreciate your attention to this matter and would be happy to provide additional information if needed.\n\nThank you for your consideration.\n\nSincerely,\n[Your Name]",
      emailSubject: "Request for Sidewalk Repair on Oak Street",
      emailRecipient: "publicworks@cityname.gov",
      upvotes: 23,
      emailsSent: 12,
      progressStatus: "idea_submitted",
      photoUrl: null,
      photoData: null,
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      createdBy: null
    };
    
    const project3: Project = {
      id: this.projectId++,
      title: "Large Pothole on Main Street",
      description: "Deep pothole causing vehicle damage and traffic backup during rush hours.",
      issueType: "pothole",
      location: "Main Street & Broadway",
      latitude: "37.7739",
      longitude: "-122.4174",
      urgencyLevel: "high",
      contactEmail: "reporter@example.com",
      emailTemplate: "Dear Street Maintenance Department,\n\nI am writing to report a large, hazardous pothole on Main Street near the intersection with Broadway. This pothole is approximately 2 feet wide and 8 inches deep, posing a significant risk to vehicles and causing traffic disruptions, especially during peak hours.\n\nOver the past two weeks, I have observed multiple vehicles sustaining damage after hitting this pothole, and the situation worsens during rainy weather when the pothole fills with water and becomes less visible to drivers.\n\nThis section of Main Street experiences heavy traffic throughout the day, and the pothole has already caused several near-accidents as drivers swerve unexpectedly to avoid it. I believe this represents a high-urgency safety issue that requires prompt attention.\n\nI respectfully request that the maintenance team repair this pothole as soon as possible to prevent further vehicle damage and potential accidents. I would be happy to provide more specific location details or photos if needed.\n\nThank you for your attention to this matter.\n\nSincerely,\n[Your Name]",
      emailSubject: "Urgent: Hazardous Pothole on Main Street Requiring Immediate Repair",
      emailRecipient: "streetmaintenance@cityname.gov",
      upvotes: 67,
      emailsSent: 52,
      progressStatus: "official_acknowledgment",
      photoUrl: null,
      photoData: null,
      createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), // 21 days ago
      createdBy: null
    };
    
    this.projects.set(project1.id, project1);
    this.projects.set(project2.id, project2);
    this.projects.set(project3.id, project3);
    
    // Add some activities
    this.createActivity({
      projectId: project1.id,
      activityType: 'email_sent',
      actorName: 'Alex Johnson',
      description: 'Sent an email about Crosswalk Needed at Lincoln & 5th Ave'
    });
    
    this.createActivity({
      projectId: project3.id,
      activityType: 'status_change',
      actorName: 'City Council',
      description: 'Acknowledged Large Pothole on Main Street'
    });
    
    this.createActivity({
      projectId: project2.id,
      activityType: 'project_created',
      actorName: 'Maria Lopez',
      description: 'Submitted a new issue: Broken Sidewalk on Oak Street'
    });
    
    // Add some sample comments
    const comment1: Comment = {
      id: this.commentId++,
      projectId: project1.id,
      text: "I cross this intersection daily and it's very dangerous. We definitely need a crosswalk here.",
      commenterName: "David Chen",
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
    };
    
    const comment2: Comment = {
      id: this.commentId++,
      projectId: project1.id,
      text: "I witnessed a near-miss accident here last week. The city needs to take action quickly.",
      commenterName: "Sarah Williams",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
    };
    
    const comment3: Comment = {
      id: this.commentId++,
      projectId: project3.id,
      text: "My car was damaged by this pothole. It's much worse after the recent rain.",
      commenterName: "Michael Rodriguez",
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
    };
    
    this.comments.set(comment1.id, comment1);
    this.comments.set(comment2.id, comment2);
    this.comments.set(comment3.id, comment3);
  }
}

export const storage = new MemStorage();
