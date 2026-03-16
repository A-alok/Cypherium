from services.ai_service import AIService

class IncidentService:
    """Service for providing incident guidance and response actions."""
    
    def __init__(self):
        self.ai_service = AIService()
        self.threat_responses = {
            "phishing": [
                "Change your account password immediately.",
                "Enable Two-Factor Authentication (2FA) if not already active.",
                "Check your recent login activity for unrecognized devices.",
                "Report this URL to Google Safe Browsing."
            ],
            "malicious": [
                "Disconnect your device from the internet if you downloaded any files.",
                "Run a full system malware scan using your antivirus software.",
                "Clear your browser cache and cookies.",
                "Check for unauthorized browser extensions."
            ],
            "scam": [
                "Do not provide any personal or financial information.",
                "Block the sender and report the message as spam.",
                "Monitor your bank statements for suspicious transactions.",
                "Enable scam protection on your messaging platform."
            ],
            "suspicious": [
                "Be cautious and double-check the sender's identity.",
                "Do not click on any more links from this source.",
                "Update your browser and security patches."
            ]
        }
    
    def get_guidance(self, threat_type: str, scenario: str = None) -> List[str]:
        """Get step-by-step guidance for a specific threat type, using AI if possible."""
        threat_type = threat_type.lower()
        
        # If we have a specific scenario and AI is enabled, use AI for better guidance
        if scenario and self.ai_service.client:
            try:
                ai_guidance = self.ai_service.generate_incident_guidance(f"{threat_type}: {scenario}")
                if ai_guidance:
                    return ai_guidance
            except:
                pass

        return self.threat_responses.get(threat_type, [
            "Contact your IT security department.",
            "Avoid interacting with suspicious content.",
            "Keep your software up to date."
        ])

    def record_incident(self, user_id: str, incident_data: Dict[str, Any], db):
        """Record a security incident in the database."""
        incident_doc = {
            "user_id": user_id,
            "type": incident_data.get("type"),
            "content": incident_data.get("content"),
            "guidance": self.get_guidance(incident_data.get("type"), incident_data.get("content")),
            "timestamp": incident_data.get("timestamp")
        }
        db.incidents.insert_one(incident_doc)
        return incident_doc
