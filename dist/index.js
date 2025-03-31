// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
var MemStorage = class {
  users;
  projects;
  upvotes;
  emails;
  activities;
  comments;
  userId;
  projectId;
  upvoteId;
  emailId;
  activityId;
  commentId;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.projects = /* @__PURE__ */ new Map();
    this.upvotes = /* @__PURE__ */ new Map();
    this.emails = /* @__PURE__ */ new Map();
    this.activities = /* @__PURE__ */ new Map();
    this.comments = /* @__PURE__ */ new Map();
    this.userId = 1;
    this.projectId = 1;
    this.upvoteId = 1;
    this.emailId = 1;
    this.activityId = 1;
    this.commentId = 1;
    this.addSampleData();
  }
  // User operations
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );
  }
  async createUser(insertUser) {
    const id = this.userId++;
    const now = /* @__PURE__ */ new Date();
    const user = {
      ...insertUser,
      id,
      role: "user",
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
  async getUserByEmail(email) {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }
  async updateUser(id, updates) {
    const user = this.users.get(id);
    if (!user) return void 0;
    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  // Project operations
  async getAllProjects() {
    return Array.from(this.projects.values()).sort((a, b) => b.upvotes - a.upvotes);
  }
  async getProjectById(id) {
    return this.projects.get(id);
  }
  async getProjectsByType(issueType) {
    return Array.from(this.projects.values()).filter((project) => project.issueType === issueType).sort((a, b) => b.upvotes - a.upvotes);
  }
  async getProjectsByStatus(progressStatus) {
    return Array.from(this.projects.values()).filter((project) => project.progressStatus === progressStatus).sort((a, b) => b.upvotes - a.upvotes);
  }
  async createProject(insertProject) {
    const id = this.projectId++;
    const project = {
      ...insertProject,
      id,
      upvotes: 0,
      emailsSent: 0,
      progressStatus: "idea_submitted",
      createdAt: /* @__PURE__ */ new Date(),
      createdBy: insertProject.createdBy || null,
      urgencyLevel: insertProject.urgencyLevel || "medium",
      contactEmail: insertProject.contactEmail || null,
      photoUrl: insertProject.photoUrl || null,
      photoData: insertProject.photoData || null
    };
    this.projects.set(id, project);
    await this.createActivity({
      projectId: id,
      activityType: "project_created",
      actorName: "Anonymous User",
      description: `New issue submitted: ${project.title}`
    });
    return project;
  }
  async updateProject(id, updates) {
    const project = this.projects.get(id);
    if (!project) return void 0;
    if (updates.progressStatus) {
      updates.progressStatus = updates.progressStatus;
    }
    const updatedProject = { ...project, ...updates };
    this.projects.set(id, updatedProject);
    if (updates.progressStatus && updates.progressStatus !== project.progressStatus) {
      await this.createActivity({
        projectId: id,
        activityType: "status_change",
        actorName: "System",
        description: `Project status updated to: ${updates.progressStatus}`
      });
    }
    return updatedProject;
  }
  // Upvote operations
  async createUpvote(insertUpvote) {
    const id = this.upvoteId++;
    const upvote = {
      ...insertUpvote,
      id,
      createdAt: /* @__PURE__ */ new Date(),
      userId: insertUpvote.userId || null
    };
    this.upvotes.set(id, upvote);
    const project = this.projects.get(upvote.projectId);
    if (project) {
      await this.updateProject(project.id, {
        upvotes: project.upvotes + 1,
        progressStatus: this.determineProgressStatus(project.upvotes + 1, project.emailsSent, project.progressStatus)
      });
      await this.createActivity({
        projectId: project.id,
        activityType: "upvote",
        actorName: "Anonymous User",
        description: `Someone upvoted: ${project.title}`
      });
    }
    return upvote;
  }
  async getUpvotesByProject(projectId) {
    return Array.from(this.upvotes.values()).filter((upvote) => upvote.projectId === projectId);
  }
  async hasUserUpvoted(projectId, ipAddress) {
    return Array.from(this.upvotes.values()).some((upvote) => upvote.projectId === projectId && upvote.ipAddress === ipAddress);
  }
  // Email operations
  async createEmail(insertEmail) {
    const id = this.emailId++;
    const email = {
      ...insertEmail,
      id,
      sentAt: /* @__PURE__ */ new Date(),
      senderEmail: insertEmail.senderEmail || null,
      senderName: insertEmail.senderName || null,
      customContent: insertEmail.customContent || null
    };
    this.emails.set(id, email);
    const project = this.projects.get(email.projectId);
    if (project) {
      await this.updateProject(project.id, {
        emailsSent: project.emailsSent + 1,
        progressStatus: this.determineProgressStatus(project.upvotes, project.emailsSent + 1, project.progressStatus)
      });
      await this.createActivity({
        projectId: project.id,
        activityType: "email_sent",
        actorName: email.senderName || "Anonymous User",
        description: `Email sent regarding: ${project.title}`
      });
    }
    return email;
  }
  async getEmailsByProject(projectId) {
    return Array.from(this.emails.values()).filter((email) => email.projectId === projectId).sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  }
  // Activity operations
  async createActivity(insertActivity) {
    const id = this.activityId++;
    const activity = {
      ...insertActivity,
      id,
      createdAt: /* @__PURE__ */ new Date(),
      actorName: insertActivity.actorName || null
    };
    this.activities.set(id, activity);
    return activity;
  }
  async getRecentActivities(limit) {
    return Array.from(this.activities.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  }
  async getActivitiesByProject(projectId) {
    return Array.from(this.activities.values()).filter((activity) => activity.projectId === projectId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  // Stats operations
  async getCommunityStats() {
    const projects2 = Array.from(this.projects.values());
    const activeIssues = projects2.filter((p) => p.progressStatus !== "completed").length;
    const issuesResolved = projects2.filter((p) => p.progressStatus === "completed").length;
    const totalIssues = projects2.length;
    const totalEmails = Array.from(this.emails.values()).length;
    const successRate = totalIssues > 0 ? Math.round(issuesResolved / totalIssues * 100) : 0;
    return {
      activeIssues,
      emailsSent: totalEmails,
      issuesResolved,
      successRate
    };
  }
  // Search and filter operations
  async searchProjects(query) {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.projects.values()).filter(
      (project) => project.title.toLowerCase().includes(lowerQuery) || project.description.toLowerCase().includes(lowerQuery) || project.location.toLowerCase().includes(lowerQuery)
    ).sort((a, b) => b.upvotes - a.upvotes);
  }
  // Comment operations
  async createComment(insertComment) {
    const id = this.commentId++;
    const comment = {
      ...insertComment,
      id,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.comments.set(id, comment);
    await this.createActivity({
      projectId: comment.projectId,
      activityType: "comment_added",
      actorName: comment.commenterName,
      description: `New comment on project: ${this.projects.get(comment.projectId)?.title || "Unknown Project"}`
    });
    return comment;
  }
  async getCommentsByProject(projectId) {
    return Array.from(this.comments.values()).filter((comment) => comment.projectId === projectId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  // Helper method to determine progress status based on upvotes and emails
  determineProgressStatus(upvotes2, emailsSent, currentStatus) {
    if (["official_acknowledgment", "planning_stage", "implementation", "completed"].includes(currentStatus)) {
      return currentStatus;
    }
    if (emailsSent >= 50) {
      return "email_campaign_active";
    } else if (upvotes2 >= 25) {
      return "community_support";
    } else {
      return "idea_submitted";
    }
  }
  // Add some sample data for development
  addSampleData() {
    const project1 = {
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
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3),
      // 7 days ago
      createdBy: null
    };
    const project2 = {
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
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1e3),
      // 14 days ago
      createdBy: null
    };
    const project3 = {
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
      createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1e3),
      // 21 days ago
      createdBy: null
    };
    this.projects.set(project1.id, project1);
    this.projects.set(project2.id, project2);
    this.projects.set(project3.id, project3);
    this.createActivity({
      projectId: project1.id,
      activityType: "email_sent",
      actorName: "Alex Johnson",
      description: "Sent an email about Crosswalk Needed at Lincoln & 5th Ave"
    });
    this.createActivity({
      projectId: project3.id,
      activityType: "status_change",
      actorName: "City Council",
      description: "Acknowledged Large Pothole on Main Street"
    });
    this.createActivity({
      projectId: project2.id,
      activityType: "project_created",
      actorName: "Maria Lopez",
      description: "Submitted a new issue: Broken Sidewalk on Oak Street"
    });
    const comment1 = {
      id: this.commentId++,
      projectId: project1.id,
      text: "I cross this intersection daily and it's very dangerous. We definitely need a crosswalk here.",
      commenterName: "David Chen",
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1e3)
      // 5 days ago
    };
    const comment2 = {
      id: this.commentId++,
      projectId: project1.id,
      text: "I witnessed a near-miss accident here last week. The city needs to take action quickly.",
      commenterName: "Sarah Williams",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1e3)
      // 3 days ago
    };
    const comment3 = {
      id: this.commentId++,
      projectId: project3.id,
      text: "My car was damaged by this pothole. It's much worse after the recent rain.",
      commenterName: "Michael Rodriguez",
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1e3)
      // 10 days ago
    };
    this.comments.set(comment1.id, comment1);
    this.comments.set(comment2.id, comment2);
    this.comments.set(comment3.id, comment3);
  }
};
var storage = new MemStorage();

// server/openai.ts
import OpenAI from "openai";
var apiKey = process.env.OPENAI_API_KEY;
console.log(
  "OpenAI API Key status:",
  apiKey ? `Key loaded (starts with ${apiKey.substring(0, 3)}...)` : "No API key found"
);
var openai = new OpenAI({
  apiKey: apiKey || "sk-dummy-key-for-development"
});
async function generateEmailTemplate(issueType, location, description, urgencyLevel) {
  const apiKey2 = process.env.OPENAI_API_KEY;
  if (!apiKey2 || apiKey2 === "sk-dummy-key-for-development") {
    console.log("Using fallback email template due to missing API key");
    return getFallbackEmailTemplate(issueType, location, description, urgencyLevel);
  }
  try {
    console.log("Attempting to generate email template with OpenAI for issue:", issueType);
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an assistant helping citizens write brief, friendly emails to local officials about infrastructure issues. Create short, fact-based emails that sound natural but ONLY use the information provided. Avoid overly formal language and stick strictly to the details given. Never add fictional scenarios, personal stories, or made-up examples. Limit emails to 2-3 short paragraphs. Include a subject line and determine the most appropriate municipal department to address the email to."
        },
        {
          role: "user",
          content: `Please write a clear, concise email to a local city official about a ${issueType} issue at ${location}. The urgency level is ${urgencyLevel}. Here's a description of the issue: "${description}". Use ONLY the information provided - do not add fictional details or scenarios. Format your response as JSON with fields: emailSubject, emailTo (department email), and emailBody.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content returned from OpenAI");
    }
    const result = JSON.parse(content);
    if (!result.emailTo) {
      const departmentEmails = {
        crosswalk: "transportation@cityname.gov",
        pothole: "streetmaintenance@cityname.gov",
        sidewalk: "publicworks@cityname.gov",
        streetlight: "utilities@cityname.gov",
        other: "cityhall@cityname.gov"
      };
      result.emailTo = departmentEmails[issueType] || "cityhall@cityname.gov";
    }
    return {
      emailBody: result.emailBody,
      emailSubject: result.emailSubject,
      emailTo: result.emailTo
    };
  } catch (error) {
    console.error("Error generating email template:", error);
    return getFallbackEmailTemplate(issueType, location, description, urgencyLevel);
  }
}
function getFallbackEmailTemplate(issueType, location, description, urgencyLevel) {
  const departmentEmails = {
    crosswalk: "transportation@cityname.gov",
    pothole: "streetmaintenance@cityname.gov",
    sidewalk: "publicworks@cityname.gov",
    streetlight: "utilities@cityname.gov",
    other: "cityhall@cityname.gov"
  };
  const departments = {
    crosswalk: "Transportation Department",
    pothole: "Street Maintenance Department",
    sidewalk: "Public Works Department",
    streetlight: "Utilities Department",
    other: "City Hall"
  };
  const issueNames = {
    crosswalk: "crosswalk",
    pothole: "pothole",
    sidewalk: "sidewalk",
    streetlight: "streetlight",
    other: "infrastructure issue"
  };
  const issueName = issueNames[issueType] || "infrastructure issue";
  const department = departments[issueType] || "City Official";
  const emailTo = departmentEmails[issueType] || "cityhall@cityname.gov";
  const emailSubject = `${location} ${issueName} needs attention`;
  const emailBody = `Dear ${department},

I'm writing about a ${issueName} at ${location} that needs your attention. ${urgencyLevel === "high" ? "This is an urgent safety issue." : ""}

${description}

Could someone from your office look into this matter? I'm available to provide any additional information if needed.

Thanks for your consideration,
[Your Name]`;
  return {
    emailBody,
    emailSubject,
    emailTo
  };
}
async function analyzePhotoForIssueType(base64Image) {
  try {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-dummy-key-for-development") {
      console.log("Using fallback issue classification due to missing API key");
      return {
        issueType: "other",
        confidence: 0,
        description: "Unable to analyze image. Please select the issue type manually."
      };
    }
    console.log("Attempting to analyze photo with OpenAI API...");
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        {
          role: "system",
          content: `You are an AI specialized in identifying urban infrastructure issues. 
          Analyze the provided photo and determine which category the issue falls into: 
          'pothole', 'sidewalk', 'crosswalk', 'streetlight', or 'other'. 
          Provide a confidence score (0-1) for your classification and a brief description of what you see.
          Format your response as a JSON object with keys: issueType, confidence, and description.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this infrastructure issue and classify it based on what you see."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" }
    });
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content returned from OpenAI");
    }
    const result = JSON.parse(content);
    return {
      issueType: result.issueType,
      confidence: result.confidence,
      description: result.description,
      location: {}
      // EXIF data would be processed client-side
    };
  } catch (error) {
    console.error("Error analyzing photo with OpenAI:", error);
    let errorMessage = "Unable to analyze the image.";
    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.message.includes("429") || error.message.includes("quota")) {
        errorMessage = "OpenAI API rate limit exceeded or quota used up. Please try again later.";
      } else if (error.message.includes("401") || error.message.includes("authentication")) {
        errorMessage = "Invalid OpenAI API key. Please check your API key configuration.";
      } else if (error.message.includes("image") && error.message.includes("format")) {
        errorMessage = "Invalid image format. Please upload a valid image file.";
      }
    }
    console.log("Detailed error message:", errorMessage);
    return {
      issueType: "other",
      confidence: 0,
      description: `Analysis error: ${errorMessage}. Please manually select the issue type.`
    };
  }
}
async function regenerateEmailWithTone(originalEmail, tone) {
  try {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-dummy-key-for-development") {
      console.log("Using fallback tone adjustment due to missing API key");
      return {
        emailBody: applyFallbackToneAdjustment(originalEmail, tone)
      };
    }
    console.log(`Attempting to regenerate email with tone: ${tone} using OpenAI API...`);
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an assistant helping citizens write brief emails to local officials. You'll be given an existing email and asked to rewrite it with a ${tone} tone. IMPORTANT: Don't add any fictional details, names, or scenarios that weren't in the original email. Only adjust the tone and writing style without embellishing or adding new information. Keep it short (2-3 paragraphs) and ensure you only use facts from the original email.`
        },
        {
          role: "user",
          content: `Please rewrite this email with a ${tone} tone. Keep it brief and stick ONLY to the information provided in the original email. DO NOT add any fictional details, people, or scenarios:

${originalEmail}`
        }
      ],
      temperature: 0.7
    });
    return {
      emailBody: response.choices[0].message.content || originalEmail
    };
  } catch (error) {
    console.error("Error regenerating email with tone:", error);
    let errorMessage = "Unable to adjust email tone due to a service error.";
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "insufficient_quota") {
        errorMessage = "Unable to adjust email tone due to API usage limits.";
      }
    }
    return {
      emailBody: applyFallbackToneAdjustment(originalEmail, tone),
      error: errorMessage
    };
  }
}
function applyFallbackToneAdjustment(email, tone) {
  const salutationMatch = email.match(/^(Dear.*?)(?=\n)/);
  const salutation = salutationMatch ? salutationMatch[0] : "Dear City Official";
  const signoffMatch = email.match(/\n(Sincerely|Regards|Thank you|Best regards|Yours truly|Respectfully).*$/);
  const signoff = signoffMatch ? signoffMatch[0].trim() : "\n\nSincerely,\n[Your Name]";
  const locationMatch = email.match(/\b(?:at|near|on|in|by)\s+([A-Za-z0-9\s\.]+(?:Street|Avenue|Road|Place|Blvd|Boulevard|Lane|Drive|Way|Intersection|Park|Plaza|Square|Ave\.|Rd\.|St\.|Dr\.))/i);
  const location = locationMatch ? locationMatch[0] : "in our community";
  const issueTypeMatch = email.match(/\b(?:pothole|crosswalk|sidewalk|streetlight|traffic light|sign|infrastructure|safety hazard|drainage|flooding|accessibility)\b/i);
  const issueType = issueTypeMatch ? issueTypeMatch[0].toLowerCase() : "infrastructure issue";
  let adjustedEmail = "";
  switch (tone.toLowerCase()) {
    case "professional":
      adjustedEmail = `${salutation},

I'm writing to inform you about a ${issueType} ${location} that requires attention. This presents a safety concern for residents using this area.

Would your department be able to address this matter? I'm available to provide any additional information that might be helpful.

${signoff}`;
      break;
    case "formal":
      adjustedEmail = `${salutation},

I'm writing to request your department's attention to a ${issueType} ${location}.

This infrastructure issue falls under your department's responsibility and should be addressed per municipal standards.

${signoff}`;
      break;
    case "assertive":
      adjustedEmail = `${salutation},

The ${issueType} ${location} needs immediate attention. This presents a clear safety risk that should be addressed promptly.

I expect this matter to be resolved soon. Please inform me of what steps will be taken to fix this issue.

${signoff}`;
      break;
    case "concerned":
      adjustedEmail = `${salutation},

I'm concerned about the ${issueType} ${location} in our community. This issue creates difficulties for residents and could lead to injuries if not addressed.

Please consider the safety impact this has on our community and address it soon.

${signoff}`;
      break;
    case "personal":
      adjustedEmail = `${salutation},

I wanted to reach out about the ${issueType} ${location} that I frequently encounter. This has been causing problems for myself and others in the area.

Our neighborhood would really benefit from having this fixed. I appreciate your consideration of this request.

${signoff}`;
      break;
    default:
      return email;
  }
  return adjustedEmail;
}

// server/email.ts
import nodemailer from "nodemailer";
var emailConfig = {
  host: process.env.EMAIL_HOST || "smtp.example.com",
  port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587,
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER || "dummy_user",
    pass: process.env.EMAIL_PASSWORD || "dummy_password"
  }
};
var transporter = nodemailer.createTransport(emailConfig);
var SIMULATE_EMAIL_SENDING = process.env.NODE_ENV !== "production" || !process.env.EMAIL_HOST;
async function sendEmail(options) {
  const { from, to, subject, text: text2, html, senderName, attachments } = options;
  try {
    if (SIMULATE_EMAIL_SENDING) {
      console.log("\n--- EMAIL WOULD BE SENT ---");
      console.log(`From: ${senderName ? `${senderName} <${from}>` : from}`);
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Attachments: ${attachments ? attachments.length : 0} files`);
      if (attachments?.length) {
        console.log(`Attachment filenames: ${attachments.map((a) => a.filename).join(", ")}`);
      }
      console.log(`
Body:
${text2}`);
      console.log("--- END OF EMAIL ---\n");
      return { success: true, message: "Email simulation successful" };
    } else {
      const mailOptions = {
        from: senderName ? `${senderName} <${from}>` : from,
        to,
        subject,
        text: text2,
        html: html || text2.replace(/\n/g, "<br>"),
        attachments: attachments || []
      };
      await transporter.sendMail(mailOptions);
      return { success: true, message: "Email sent successfully" };
    }
  } catch (error) {
    console.error("Error sending email:", error);
    return {
      success: false,
      message: `Failed to send email: ${error instanceof Error ? error.message : "Unknown error"}`
    };
  }
}
function normalizeEmail(email) {
  if (!email) return null;
  email = email.trim().toLowerCase();
  if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return null;
  }
  return email;
}

// shared/schema.ts
import { pgTable, text, serial, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var issueTypeEnum = pgEnum("issue_type", [
  "crosswalk",
  "pothole",
  "sidewalk",
  "streetlight",
  "other"
]);
var urgencyLevelEnum = pgEnum("urgency_level", [
  "low",
  "medium",
  "high"
]);
var progressStatusEnum = pgEnum("progress_status", [
  "idea_submitted",
  "community_support",
  "email_campaign_active",
  "official_acknowledgment",
  "planning_stage",
  "implementation",
  "completed"
]);
var userRoleEnum = pgEnum("user_role", [
  "user",
  "moderator",
  "admin"
]);
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  role: userRoleEnum("role").notNull().default("user"),
  verified: boolean("verified").notNull().default(false),
  verificationToken: text("verification_token"),
  resetPasswordToken: text("reset_password_token"),
  resetPasswordExpires: timestamp("reset_password_expires"),
  profilePicture: text("profile_picture"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  issueType: issueTypeEnum("issue_type").notNull(),
  location: text("location").notNull(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  urgencyLevel: urgencyLevelEnum("urgency_level").notNull().default("medium"),
  contactEmail: text("contact_email"),
  emailTemplate: text("email_template").notNull(),
  emailSubject: text("email_subject").notNull(),
  emailRecipient: text("email_recipient").notNull(),
  upvotes: integer("upvotes").notNull().default(0),
  emailsSent: integer("emails_sent").notNull().default(0),
  progressStatus: progressStatusEnum("progress_status").notNull().default("idea_submitted"),
  photoUrl: text("photo_url"),
  // URL to stored photo (can be null)
  photoData: text("photo_data"),
  // Base64 encoded photo data (can be null)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by")
  // Optional - can be linked to users table for authenticated users
});
var upvotes = pgTable("upvotes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  userId: integer("user_id"),
  // Optional - can be null for anonymous upvotes
  ipAddress: text("ip_address").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var emails = pgTable("emails", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  senderEmail: text("sender_email"),
  senderName: text("sender_name"),
  customContent: text("custom_content"),
  sentAt: timestamp("sent_at").notNull().defaultNow()
});
var activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  activityType: text("activity_type").notNull(),
  // email_sent, upvote, status_change, etc.
  actorName: text("actor_name"),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  text: text("text").notNull(),
  commenterName: text("commenter_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  verified: true,
  verificationToken: true,
  resetPasswordToken: true,
  resetPasswordExpires: true,
  createdAt: true,
  updatedAt: true,
  role: true
}).extend({
  password: z.string().min(8).max(100),
  email: z.string().email(),
  username: z.string().min(3).max(50),
  fullName: z.string().min(2).max(100).optional(),
  profilePicture: z.string().optional()
});
var insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  upvotes: true,
  emailsSent: true,
  createdAt: true,
  progressStatus: true
});
var insertUpvoteSchema = createInsertSchema(upvotes).omit({
  id: true,
  createdAt: true
});
var insertEmailSchema = createInsertSchema(emails).omit({
  id: true,
  sentAt: true
});
var insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true
});
var insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true
});

// server/routes.ts
import { ZodError } from "zod";
import { fromZodError as fromZodError2 } from "zod-validation-error";

// server/auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { z as z2 } from "zod";
import { fromZodError } from "zod-validation-error";
import jwt from "jsonwebtoken";
import createMemoryStore from "memorystore";
var JWT_SECRET = process.env.JWT_SECRET || randomBytes(32).toString("hex");
var SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
var TOKEN_EXPIRATION = "7d";
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${hash}.${salt}`;
}
function comparePasswords(supplied, stored) {
  const [hashedPassword, salt] = stored.split(".");
  const suppliedHash = scryptSync(supplied, salt, 64).toString("hex");
  return timingSafeEqual(
    Buffer.from(hashedPassword, "hex"),
    Buffer.from(suppliedHash, "hex")
  );
}
var loginSchema = z2.object({
  username: z2.string().min(3),
  password: z2.string().min(8)
});
function setupAuth(app2) {
  const MemoryStore = createMemoryStore(session);
  const sessionOptions = {
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1e3
      // 7 days
    },
    store: new MemoryStore({
      checkPeriod: 864e5
      // Prune expired entries every 24h
    })
  };
  app2.use(session(sessionOptions));
  app2.use(passport.initialize());
  app2.use(passport.session());
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
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  passport.deserializeUser(async (id, done) => {
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
  app2.post("/api/register", async (req, res) => {
    try {
      const { username, email, password, fullName } = req.body;
      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username already taken" });
      }
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already registered" });
      }
      const hashedPassword = hashPassword(password);
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        fullName
      });
      const { password: _, ...userWithoutPassword } = user;
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed after registration" });
        }
        return res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      if (error instanceof z2.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });
  app2.post("/api/login", (req, res, next) => {
    try {
      loginSchema.parse(req.body);
      passport.authenticate("local", (err, user, info) => {
        if (err) {
          return next(err);
        }
        if (!user) {
          return res.status(401).json({ message: info?.message || "Authentication failed" });
        }
        req.login(user, (err2) => {
          if (err2) {
            return next(err2);
          }
          const { password: _, ...userWithoutPassword } = user;
          const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
          return res.json({ user: userWithoutPassword, token });
        });
      })(req, res, next);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      next(error);
    }
  });
  app2.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.sendStatus(200);
    });
  });
  app2.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { password: _, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });
  app2.use("/api/protected/*", (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    next();
  });
  app2.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return next();
    }
    const token = authHeader.split(" ")[1];
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (!payload || typeof payload !== "object" || !("id" in payload)) {
        return res.status(403).json({ message: "Invalid token payload" });
      }
      storage.getUser(payload.id).then((user) => {
        if (!user) {
          return res.status(403).json({ message: "User not found" });
        }
        req.user = user;
        next();
      }).catch((error) => {
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
  const requireAuth = (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };
  app2.use("/api/protected", requireAuth);
}

// server/routes.ts
import OpenAI2 from "openai";
async function registerRoutes(app2) {
  const httpServer = createServer(app2);
  setupAuth(app2);
  app2.get("/api/test-openai", async (req, res) => {
    try {
      const apiKey2 = process.env.OPENAI_API_KEY;
      console.log("API Key available for testing:", apiKey2 ? "Yes (begins with " + apiKey2.substring(0, 3) + "...)" : "No");
      const openai2 = new OpenAI2({
        apiKey: apiKey2 || "sk-dummy-key-for-development"
      });
      console.log("Making test call to OpenAI API...");
      const response = await openai2.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "user", content: "Say 'OpenAI API is working!'" }
        ]
      });
      console.log("OpenAI API response:", response);
      res.json({
        status: "success",
        message: "OpenAI API test completed",
        response: response.choices[0].message.content,
        usage: response.usage
      });
    } catch (error) {
      console.error("OpenAI API test error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        status: "error",
        message: "OpenAI API test failed",
        error: errorMessage
      });
    }
  });
  app2.post("/api/analyze-photo", async (req, res) => {
    try {
      console.log("Received photo analysis request");
      const { photoData } = req.body;
      if (!photoData) {
        console.log("Missing photo data in request");
        return res.status(400).json({ message: "Photo data is required" });
      }
      const base64Data = photoData.replace(/^data:image\/\w+;base64,/, "");
      console.log("Processing photo for analysis, data length:", base64Data.length);
      const analysis = await analyzePhotoForIssueType(base64Data);
      console.log("Photo analysis completed successfully:", analysis);
      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing photo:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        message: `Error analyzing photo: ${errorMessage}`,
        issueType: "other",
        confidence: 0,
        description: "Unable to analyze the image. Please manually select the issue type."
      });
    }
  });
  app2.get("/api/projects", async (req, res) => {
    try {
      const { issueType, status, search } = req.query;
      let projects2;
      if (search && typeof search === "string") {
        projects2 = await storage.searchProjects(search);
      } else if (issueType && typeof issueType === "string") {
        projects2 = await storage.getProjectsByType(issueType);
      } else if (status && typeof status === "string") {
        projects2 = await storage.getProjectsByStatus(status);
      } else {
        projects2 = await storage.getAllProjects();
      }
      res.json(projects2);
    } catch (error) {
      console.error("Error getting projects:", error);
      res.status(500).json({ message: "Failed to get projects" });
    }
  });
  app2.get("/api/projects/:id", async (req, res) => {
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
  app2.post("/api/projects", async (req, res) => {
    try {
      const validatedData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(validatedData);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError2(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });
  app2.post("/api/generate-email", async (req, res) => {
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
      let enhancedDescription = description;
      if (impactDescription) {
        enhancedDescription += `

Impact: ${impactDescription}`;
      }
      if (affectedGroups) {
        const groupName = affectedGroups.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
        enhancedDescription += `

Affected Groups: ${groupName}`;
      }
      if (desiredOutcome) {
        const outcome = desiredOutcome.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
        enhancedDescription += `

Desired Outcome: ${outcome}`;
      }
      if (proposedSolution) {
        enhancedDescription += `

Proposed Solution: ${proposedSolution}`;
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
  app2.post("/api/regenerate-email", async (req, res) => {
    try {
      const { emailBody, tone } = req.body;
      if (!emailBody || !tone) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const result = await regenerateEmailWithTone(emailBody, tone);
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
  app2.post("/api/send-email", async (req, res) => {
    try {
      const validatedData = insertEmailSchema.parse(req.body);
      const project = await storage.getProjectById(validatedData.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      const emailContent = validatedData.customContent || project.emailTemplate;
      let attachments = [];
      if (project.photoData) {
        const matches = project.photoData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const contentType = matches[1];
          const imageData = matches[2];
          let fileExtension = "jpg";
          if (contentType.includes("png")) fileExtension = "png";
          else if (contentType.includes("gif")) fileExtension = "gif";
          attachments.push({
            filename: `issue-photo.${fileExtension}`,
            content: Buffer.from(imageData, "base64"),
            contentType,
            encoding: "base64"
          });
        }
      }
      const from = normalizeEmail(validatedData.senderEmail) || "noreply@civicvoice.org";
      const senderName = validatedData.senderName ? String(validatedData.senderName) : void 0;
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
      const email = await storage.createEmail(validatedData);
      res.status(201).json(email);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError2(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error sending email:", error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });
  app2.post("/api/projects/:id/upvote", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }
      const project = await storage.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const hasUpvoted = await storage.hasUserUpvoted(projectId, ipAddress);
      if (hasUpvoted) {
        return res.status(400).json({ message: "You have already upvoted this project" });
      }
      const upvoteData = insertUpvoteSchema.parse({
        projectId,
        ipAddress,
        userId: null
        // For anonymous upvotes
      });
      const upvote = await storage.createUpvote(upvoteData);
      const updatedProject = await storage.getProjectById(projectId);
      res.json(updatedProject);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError2(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error upvoting project:", error);
      res.status(500).json({ message: "Failed to upvote project" });
    }
  });
  app2.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getCommunityStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting stats:", error);
      res.status(500).json({ message: "Failed to get community statistics" });
    }
  });
  app2.get("/api/activities", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;
      const activities2 = await storage.getRecentActivities(limit);
      res.json(activities2);
    } catch (error) {
      console.error("Error getting activities:", error);
      res.status(500).json({ message: "Failed to get activities" });
    }
  });
  app2.get("/api/projects/:id/comments", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }
      const project = await storage.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      const comments2 = await storage.getCommentsByProject(projectId);
      res.json(comments2);
    } catch (error) {
      console.error("Error getting comments:", error);
      res.status(500).json({ message: "Failed to get comments" });
    }
  });
  app2.post("/api/projects/:id/comments", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }
      const project = await storage.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      const commentData = insertCommentSchema.parse({
        ...req.body,
        projectId
      });
      const comment = await storage.createComment(commentData);
      res.status(201).json(comment);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError2(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating comment:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2, { dirname as dirname2 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared")
    }
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = dirname2(__filename2);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        __dirname2,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(__dirname2, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json({ limit: "50mb" }));
app.use(express2.urlencoded({ extended: false, limit: "50mb" }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = 5e3;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
