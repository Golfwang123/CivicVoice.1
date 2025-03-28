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
  // Extract parts of the email
  const salutationMatch = email.match(/^(Dear.*?)(?=\n)/);
  const salutation = salutationMatch ? salutationMatch[0] : "Dear City Official";
  
  const signoffMatch = email.match(/\n(Sincerely|Regards|Thank you|Best regards|Yours truly|Respectfully).*$/);
  const signoff = signoffMatch ? signoffMatch[0].trim() : "\n\nSincerely,\n[Your Name]";
  
  // Get the body text between salutation and signoff
  let bodyText = email;
  if (salutationMatch) {
    bodyText = bodyText.replace(salutationMatch[0], "");
  }
  if (signoffMatch) {
    bodyText = bodyText.replace(signoffMatch[0], "");
  }
  bodyText = bodyText.trim();
  
  // Apply tone adjustments based on the requested tone
  let adjustedEmail = "";
  
  switch(tone.toLowerCase()) {
    case "professional":
      adjustedEmail = `${salutation},\n\nI am writing to bring to your attention a matter of community infrastructure that requires your department's consideration.\n\n${bodyText}\n\nI would appreciate your prompt attention to this matter. Please feel free to contact me if you require any additional information.\n\n${signoff}`;
      break;
      
    case "formal":
      adjustedEmail = `${salutation},\n\nI am writing to formally request your department's attention regarding an infrastructure matter in our community.\n\n${bodyText}\n\nI trust that your office will address this issue with the appropriate consideration. I remain available should further information be required.\n\n${signoff}`;
      break;
      
    case "assertive":
      adjustedEmail = `${salutation},\n\nI am writing to request immediate attention to an important infrastructure issue that needs to be addressed without delay.\n\n${bodyText}\n\nI expect this matter to be addressed promptly, as it affects many community members on a daily basis. I look forward to hearing about the concrete steps that will be taken to resolve this issue.\n\n${signoff}`;
      break;
      
    case "concerned":
      adjustedEmail = `${salutation},\n\nI am deeply concerned about an infrastructure issue in our community that is affecting residents' safety and quality of life.\n\n${bodyText}\n\nAs a concerned citizen, I am hopeful that your department will consider the human impact of this issue and take swift action. Many community members, including families with children and elderly residents, are affected by this daily.\n\n${signoff}`;
      break;
      
    case "personal":
      adjustedEmail = `${salutation},\n\nI wanted to reach out about something in our neighborhood that's been on my mind lately.\n\n${bodyText}\n\nThis matters to me personally because I walk/drive through this area daily, and I've seen how it affects our neighbors too. I appreciate you taking the time to consider this request from a local resident who cares deeply about our community.\n\n${signoff}`;
      break;
      
    default:
      // If unknown tone, return original
      return email;
  }
  
  return adjustedEmail;
}
