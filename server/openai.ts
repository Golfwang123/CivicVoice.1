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
          content: "You are an assistant helping citizens write professional emails to local officials about infrastructure issues that need attention. Generate clear, concise, and persuasive emails based on the issue details provided. Include a subject line and determine the most appropriate municipal department to address the email to.",
        },
        {
          role: "user",
          content: `Please write a professional email to a local city official requesting attention to a ${issueType} issue at ${location}. The urgency level is ${urgencyLevel}. Here's a description of the issue: "${description}". Format your response as JSON with fields: emailSubject, emailTo (department email), and emailBody.`,
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
    crosswalk: "crosswalk installation",
    pothole: "pothole repair",
    sidewalk: "sidewalk repair",
    streetlight: "street light installation",
    other: "infrastructure issue"
  };

  const issueName = issueNames[issueType] || "infrastructure issue";
  const department = departments[issueType] || "City Official";
  const emailTo = departmentEmails[issueType] || "cityhall@cityname.gov";
  
  const emailSubject = `Request for ${issueName.charAt(0).toUpperCase() + issueName.slice(1)} at ${location}`;
  
  const emailBody = `Dear ${department},

I am writing to request your attention to a ${urgencyLevel} priority ${issueName} needed at ${location}. 

${description}

This issue affects the daily lives of many residents in our community and addressing it would greatly improve local infrastructure and safety.

I would appreciate your department's consideration of this request. Please feel free to contact me if you require any additional details or community input regarding this matter.

Thank you for your attention to this important concern.

Sincerely,
[Your Name]
[Optional Contact Information]`;

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
          content: `You are an assistant helping citizens write professional emails to local officials. You'll be given an existing email and asked to rewrite it with a ${tone} tone while preserving the core message and issue details.`,
        },
        {
          role: "user",
          content: `Please rewrite this email with a ${tone} tone while keeping the same basic information and request:\n\n${originalEmail}`,
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
  
  // Apply tone adjustments based on the requested tone - completely different emails
  let adjustedEmail = "";
  
  switch(tone.toLowerCase()) {
    case "professional":
      adjustedEmail = `${salutation},\n\nI am writing to bring to your attention a matter of community infrastructure that requires your department's consideration. There is a ${issueType} ${location} that needs to be addressed.\n\nThis issue presents a potential safety concern for local residents and visitors. Proper maintenance of our community infrastructure is essential for ensuring the safety and well-being of citizens.\n\nI would appreciate your prompt attention to this matter. Please feel free to contact me if you require any additional information or would like to discuss this further.\n\n${signoff}`;
      break;
      
    case "formal":
      adjustedEmail = `${salutation},\n\nI am writing to formally request your department's attention regarding a ${issueType} ${location}.\n\nThe current condition of this infrastructure element does not meet community standards and may present liability concerns for the municipality. It is my understanding that such matters fall under your department's purview.\n\nI trust that your office will address this issue with the appropriate consideration and in accordance with municipal protocols. I remain available should further information be required.\n\n${signoff}`;
      break;
      
    case "assertive":
      adjustedEmail = `${salutation},\n\nI am writing to request immediate attention to the ${issueType} ${location}. This issue needs to be addressed without delay.\n\nThis situation has persisted for some time and poses an unacceptable risk to public safety. Multiple community members have expressed concerns about this matter, and it requires prompt resolution.\n\nI expect this matter to be addressed within the next two weeks, as it affects many community members on a daily basis. I look forward to hearing about the concrete steps that will be taken to resolve this issue and a timeline for completion.\n\n${signoff}`;
      break;
      
    case "concerned":
      adjustedEmail = `${salutation},\n\nI am deeply concerned about the ${issueType} ${location} that is affecting residents' safety and quality of life in our neighborhood.\n\nEvery day, I witness fellow residents, including elderly individuals and parents with young children, struggling to navigate around this hazard. I worry that someone could be seriously injured if this issue isn't resolved soon.\n\nAs a concerned citizen, I am hopeful that your department will consider the human impact of this issue and take swift action. This isn't merely an infrastructure problem—it's about protecting our community members and improving their daily lives.\n\n${signoff}`;
      break;
      
    case "personal":
      adjustedEmail = `${salutation},\n\nI wanted to reach out about the ${issueType} ${location} that's been on my mind lately.\n\nAs someone who passes through this area frequently, I've noticed how this issue affects not just me but many of my neighbors as well. Just last week, I saw an elderly neighbor struggling because of this problem, which made me realize how important it is to address this.\n\nThis matters to me personally because our community deserves safe and well-maintained infrastructure. I appreciate you taking the time to consider this request from a local resident who cares deeply about making our neighborhood better for everyone.\n\n${signoff}`;
      break;
      
    default:
      // If unknown tone, return original
      return email;
  }
  
  return adjustedEmail;
}
