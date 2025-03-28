import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "sk-dummy-key-for-development"
});

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
export async function generateEmailTemplate(
  issueType: string,
  location: string,
  description: string,
  urgencyLevel: string
): Promise<{ emailBody: string; emailSubject: string; emailTo: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an assistant helping citizens write brief, friendly emails to local officials about infrastructure issues. Create short, personable emails that sound like they're written by a real person, not a robot. Avoid overly formal language and keep the tone conversational. Limit emails to 3-4 short paragraphs maximum. Include a subject line and determine the most appropriate municipal department to address the email to.",
        },
        {
          role: "user",
          content: `Please write a friendly, conversational email to a local city official about a ${issueType} issue at ${location}. The urgency level is ${urgencyLevel}. Here's a description of the issue: "${description}". Keep it brief and natural-sounding. Format your response as JSON with fields: emailSubject, emailTo (department email), and emailBody.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    // Parse the JSON response
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content returned from OpenAI");
    }

    const result = JSON.parse(content);
    
    // Default email recipient if OpenAI doesn't provide one
    if (!result.emailTo) {
      // Map issue types to default department emails
      const departmentEmails: Record<string, string> = {
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
    
    // Return a fallback template if OpenAI fails
    return getFallbackEmailTemplate(issueType, location, description, urgencyLevel);
  }
}

function getFallbackEmailTemplate(
  issueType: string,
  location: string,
  description: string,
  urgencyLevel: string
): { emailBody: string; emailSubject: string; emailTo: string } {
  // Map issue types to departments
  const departmentEmails: Record<string, string> = {
    crosswalk: "transportation@cityname.gov",
    pothole: "streetmaintenance@cityname.gov",
    sidewalk: "publicworks@cityname.gov",
    streetlight: "utilities@cityname.gov",
    other: "cityhall@cityname.gov"
  };
  
  const departments: Record<string, string> = {
    crosswalk: "Transportation Department",
    pothole: "Street Maintenance Department",
    sidewalk: "Public Works Department",
    streetlight: "Utilities Department",
    other: "City Hall"
  };

  const issueNames: Record<string, string> = {
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
  
  // Create a more personable, shorter email template
  const emailBody = `Dear ${department},

I'm writing about a ${issueName} at ${location} that needs your attention. ${urgencyLevel === 'high' ? "This is an urgent safety issue." : ""}

${description}

Many residents use this area daily, and fixing this would make our neighborhood safer and more accessible.

Could someone from your office look into this soon? I'm happy to provide more details if needed.

Thanks for your help,
[Your Name]`;

  return {
    emailBody,
    emailSubject,
    emailTo
  };
}

// Function to regenerate an email with a different tone
export async function regenerateEmailWithTone(
  originalEmail: string,
  tone: string
): Promise<{ emailBody: string; error?: string }> {
  try {
    // Only attempt to call OpenAI if we have a valid API key
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-dummy-key-for-development") {
      console.log("Using fallback tone adjustment due to missing API key");
      return {
        emailBody: applyFallbackToneAdjustment(originalEmail, tone),
      };
    }
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an assistant helping citizens write brief, friendly emails to local officials. You'll be given an existing email and asked to rewrite it with a ${tone} tone while preserving the core message and issue details. Make the email sound like it was written by a real person, not a robot. Keep it short (3-4 paragraphs max) and conversational. Avoid overly formal language unless specifically requested.`,
        },
        {
          role: "user",
          content: `Please rewrite this email with a ${tone} tone. Keep it short, friendly, and natural-sounding while maintaining the same basic information about the issue:\n\n${originalEmail}`,
        },
      ],
      temperature: 0.7,
    });

    return {
      emailBody: response.choices[0].message.content || originalEmail
    };
  } catch (error) {
    console.error("Error regenerating email with tone:", error);
    
    // Provide a more helpful error message
    let errorMessage = "Unable to adjust email tone due to a service error.";
    
    // Check if error is an object with a code property
    if (error && typeof error === 'object' && 'code' in error) {
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

// Fallback function to adjust email tone without using OpenAI
function applyFallbackToneAdjustment(email: string, tone: string): string {
  // Extract parts of the email - we'll use these to construct a completely new email
  
  // Extract the salutation (Dear...)
  const salutationMatch = email.match(/^(Dear.*?)(?=\n)/);
  const salutation = salutationMatch ? salutationMatch[0] : "Dear City Official";
  
  // Extract the signoff (Sincerely...)
  const signoffMatch = email.match(/\n(Sincerely|Regards|Thank you|Best regards|Yours truly|Respectfully).*$/);
  const signoff = signoffMatch ? signoffMatch[0].trim() : "\n\nSincerely,\n[Your Name]";
  
  // Extract key information from the email to preserve in the tone-adjusted version
  const locationMatch = email.match(/\b(?:at|near|on|in|by)\s+([A-Za-z0-9\s\.]+(?:Street|Avenue|Road|Place|Blvd|Boulevard|Lane|Drive|Way|Intersection|Park|Plaza|Square|Ave\.|Rd\.|St\.|Dr\.))/i);
  const location = locationMatch ? locationMatch[0] : "in our community";
  
  // Extract type of issue from the original email
  const issueTypeMatch = email.match(/\b(?:pothole|crosswalk|sidewalk|streetlight|traffic light|sign|infrastructure|safety hazard|drainage|flooding|accessibility)\b/i);
  const issueType = issueTypeMatch ? issueTypeMatch[0].toLowerCase() : "infrastructure issue";
  
  // Apply tone adjustments - shorter, more personable emails that sound like a real person
  let adjustedEmail = "";
  
  switch(tone.toLowerCase()) {
    case "professional":
      adjustedEmail = `${salutation},\n\nI'm writing about the ${issueType} ${location} that needs attention. This is creating safety concerns for residents in the area.\n\nCould your department look into this soon? I'd be happy to provide more details if needed.\n\n${signoff}`;
      break;
      
    case "formal":
      adjustedEmail = `${salutation},\n\nI'd like to request your department's attention to a ${issueType} ${location}.\n\nThis issue falls under your department's responsibility and should be addressed according to city standards. I'm available to provide additional information if needed.\n\n${signoff}`;
      break;
      
    case "assertive":
      adjustedEmail = `${salutation},\n\nThe ${issueType} ${location} needs immediate attention. This has been a problem for a while now and poses real safety risks.\n\nMany neighbors have complained about this issue. We need this fixed within the next two weeks. What steps will your department take to resolve this?\n\n${signoff}`;
      break;
      
    case "concerned":
      adjustedEmail = `${salutation},\n\nI'm worried about the ${issueType} ${location} in our neighborhood. I've seen seniors and parents with strollers struggling to navigate around it.\n\nSomeone could get hurt if this isn't fixed soon. Please consider how this affects our community's daily lives and safety.\n\n${signoff}`;
      break;
      
    case "personal":
      adjustedEmail = `${salutation},\n\nI wanted to reach out about the ${issueType} ${location} that I pass by every day. Last week, I noticed my elderly neighbor Mrs. Johnson having trouble with it, which really concerned me.\n\nOur neighborhood deserves safe infrastructure. Thanks for considering this request from a resident who cares about our community.\n\n${signoff}`;
      break;
      
    default:
      // If unknown tone, return original
      return email;
  }
  
  return adjustedEmail;
}
