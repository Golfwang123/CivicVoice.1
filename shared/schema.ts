import { pgTable, text, serial, integer, boolean, timestamp, varchar, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enum for issue types
export const issueTypeEnum = pgEnum('issue_type', [
  'crosswalk',
  'pothole',
  'sidewalk',
  'streetlight',
  'other'
]);

// Enum for urgency levels
export const urgencyLevelEnum = pgEnum('urgency_level', [
  'low',
  'medium',
  'high'
]);

// Enum for project progress
export const progressStatusEnum = pgEnum('progress_status', [
  'idea_submitted',
  'community_support',
  'email_campaign_active',
  'official_acknowledgment',
  'planning_stage',
  'implementation',
  'completed'
]);

// Enum for user roles
export const userRoleEnum = pgEnum('user_role', [
  'user',
  'moderator',
  'admin'
]);

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  role: userRoleEnum("role").notNull().default('user'),
  verified: boolean("verified").notNull().default(false),
  verificationToken: text("verification_token"),
  resetPasswordToken: text("reset_password_token"),
  resetPasswordExpires: timestamp("reset_password_expires"),
  profilePicture: text("profile_picture"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Projects table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  issueType: issueTypeEnum("issue_type").notNull(),
  location: text("location").notNull(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  urgencyLevel: urgencyLevelEnum("urgency_level").notNull().default('medium'),
  contactEmail: text("contact_email"),
  emailTemplate: text("email_template").notNull(),
  emailSubject: text("email_subject").notNull(),
  emailRecipient: text("email_recipient").notNull(),
  upvotes: integer("upvotes").notNull().default(0),
  emailsSent: integer("emails_sent").notNull().default(0),
  progressStatus: progressStatusEnum("progress_status").notNull().default('idea_submitted'),
  photoUrl: text("photo_url"), // URL to stored photo (can be null)
  photoData: text("photo_data"), // Base64 encoded photo data (can be null)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by"), // Optional - can be linked to users table for authenticated users
});

// Upvotes table to track who upvoted what
export const upvotes = pgTable("upvotes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  userId: integer("user_id"), // Optional - can be null for anonymous upvotes
  ipAddress: text("ip_address").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Emails table to track sent emails
export const emails = pgTable("emails", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  senderEmail: text("sender_email"),
  senderName: text("sender_name"),
  customContent: text("custom_content"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

// Activity table to track recent actions
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  activityType: text("activity_type").notNull(), // email_sent, upvote, status_change, etc.
  actorName: text("actor_name"),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Comments table for project discussions
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  text: text("text").notNull(),
  commenterName: text("commenter_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users)
  .omit({
    id: true,
    verified: true,
    verificationToken: true,
    resetPasswordToken: true,
    resetPasswordExpires: true,
    createdAt: true,
    updatedAt: true,
    role: true,
  })
  .extend({
    password: z.string().min(8).max(100),
    email: z.string().email(),
    username: z.string().min(3).max(50),
    fullName: z.string().min(2).max(100).optional(),
    profilePicture: z.string().optional(),
  });

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  upvotes: true,
  emailsSent: true,
  createdAt: true,
  progressStatus: true,
});

export const insertUpvoteSchema = createInsertSchema(upvotes).omit({
  id: true,
  createdAt: true,
});

export const insertEmailSchema = createInsertSchema(emails).omit({
  id: true,
  sentAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Upvote = typeof upvotes.$inferSelect;
export type InsertUpvote = z.infer<typeof insertUpvoteSchema>;

export type Email = typeof emails.$inferSelect;
export type InsertEmail = z.infer<typeof insertEmailSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
