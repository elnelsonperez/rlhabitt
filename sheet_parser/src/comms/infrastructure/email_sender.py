"""Email sender using Resend.com API."""
import os
from typing import Optional, Dict, Any, List, Tuple

import resend
from resend.exceptions import ResendError

from src.logger import get_logger

logger = get_logger(__name__)

class EmailSender:
    """Client for sending emails using Resend.com"""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize the email sender with the Resend API key."""
        self.api_key = api_key or os.environ.get("RESEND_API_KEY")
        if not self.api_key:
            logger.warning("No Resend API key provided. Emails will not be sent.")
        else:
            resend.api_key = self.api_key
    
    def send_email(self, 
                  from_email: str,
                  to_email: str,
                  subject: str,
                  html_content: str,
                  cc: Optional[List[str]] = None,
                  bcc: Optional[List[str]] = None,
                  reply_to: Optional[str] = None,
                  tags: Optional[List[Dict[str, str]]] = None) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Send an email using Resend.
        
        Args:
            from_email: Sender email address
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML content of the email
            cc: List of CC recipients
            bcc: List of BCC recipients
            reply_to: Reply-to email address
            tags: List of tag dictionaries with name and value
            
        Returns:
            Tuple containing:
            - Success flag (True/False)
            - Message ID if successful, None otherwise
            - Error message if failed, None otherwise
        """
        if not self.api_key:
            logger.error("Cannot send email: No Resend API key configured")
            return False, None, "No API key configured"
        
        try:
            logger.info(f"Sending email to {to_email} with subject: {subject}")
            
            params = {
                "from": from_email,
                "to": to_email,
                "subject": subject,
                "html": html_content,
            }
            
            # Add optional parameters if provided
            if cc:
                params["cc"] = cc
            if bcc:
                params["bcc"] = bcc
            if reply_to:
                params["reply_to"] = reply_to
            if tags:
                params["tags"] = tags
            
            response = resend.Emails.send(params)
            
            logger.info(f"Email sent successfully. Message ID: {response['id']}")
            return True, response["id"], None
            
        except ResendError as e:
            error_message = f"Failed to send email: {str(e)}"
            logger.exception(error_message)
            return False, None, error_message
        
        except Exception as e:
            error_message = f"Unexpected error sending email: {str(e)}"
            logger.exception(error_message)
            return False, None, error_message