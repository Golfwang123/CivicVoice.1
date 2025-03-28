// Client-side types
export type IssueType = 'crosswalk' | 'pothole' | 'sidewalk' | 'streetlight' | 'other';

export type UrgencyLevel = 'low' | 'medium' | 'high';

export type ProgressStatus = 
  | 'idea_submitted'
  | 'community_support'
  | 'email_campaign_active'
  | 'official_acknowledgment'
  | 'planning_stage'
  | 'implementation'
  | 'completed';

export interface Project {
  id: number;
  title: string;
  description: string;
  issueType: IssueType;
  location: string;
  latitude: string;
  longitude: string;
  urgencyLevel: UrgencyLevel;
  contactEmail: string | null;
  emailTemplate: string;
  emailSubject: string;
  emailRecipient: string;
  upvotes: number;
  emailsSent: number;
  progressStatus: ProgressStatus;
  photoUrl?: string | null;  // URL to the stored photo
  photoData?: string | null; // Base64 encoded photo data
  createdAt: string;
  createdBy?: number;
}

export interface EmailTemplate {
  emailBody: string;
  emailSubject: string;
  emailTo: string;
}

export interface Activity {
  id: number;
  projectId: number;
  activityType: string;
  actorName: string | null;
  description: string;
  createdAt: string;
}

export interface CommunityStats {
  activeIssues: number;
  emailsSent: number;
  issuesResolved: number;
  successRate: number;
}

export interface MapLocation {
  latitude: string;
  longitude: string;
}

export interface EmailSubmission {
  projectId: number;
  senderEmail?: string;
  senderName?: string;
  customContent?: string;
}

export interface IssueSubmissionData {
  title: string;
  description: string;
  issueType: IssueType;
  location: string;
  latitude: string;
  longitude: string;
  urgencyLevel: UrgencyLevel;
  contactEmail: string | null;
  emailTemplate: string;
  emailSubject: string;
  emailRecipient: string;
  photoUrl?: string | null;
  photoData?: string | null;
}

export interface Comment {
  id: number;
  projectId: number;
  text: string;
  commenterName: string;
  createdAt: string;
}
