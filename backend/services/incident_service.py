from typing import Dict, List, Any, Optional
from datetime import datetime
from bson.objectid import ObjectId
from services.ai_service import AIService

class IncidentService:
    """Service for managing cyber incident response and playbooks."""

    def __init__(self):
        self.ai_service = AIService()
        # Default playbooks for common scenarios
        self.playbooks = {
            "compromised_password": {
                "id": "compromised_password",
                "title": "Compromised Password Recovery",
                "description": "Step-by-step guide to secure an account with a leaked or stolen password.",
                "severity": "high",
                "steps": [
                    {
                        "step_id": 1,
                        "title": "Change the password immediately",
                        "description": "Log into the affected service directly (do not use links from emails) and change your password to a strong, unique one.",
                        "action_type": "manual"
                    },
                    {
                        "step_id": 2,
                        "title": "Enable Two-Factor Authentication (2FA)",
                        "description": "If available, turn on 2FA (preferably via an authenticator app, not SMS) to add a second layer of security.",
                        "action_type": "manual"
                    },
                    {
                        "step_id": 3,
                        "title": "Check for password reuse",
                        "description": "If you used this exact same password on any other websites, change them immediately as well.",
                        "action_type": "manual"
                    },
                    {
                        "step_id": 4,
                        "title": "Review recent activity",
                        "description": "Check the account's recent login history and active sessions. Log out any unrecognized devices.",
                        "action_type": "manual"
                    }
                ]
            },
            "phishing_clicked": {
                "id": "phishing_clicked",
                "title": "Clicked a Malicious Link",
                "description": "Actions to take if you accidentally clicked a phishing or scam link.",
                "severity": "medium",
                "steps": [
                    {
                        "step_id": 1,
                        "title": "Disconnect from the network",
                        "description": "Turn off Wi-Fi or unplug your ethernet cord to prevent any potential malware from communicating with attackers.",
                        "action_type": "manual"
                    },
                    {
                        "step_id": 2,
                        "title": "Run a full system scan",
                        "description": "Use your antivirus software to run a comprehensive scan of your entire system.",
                        "action_type": "manual"
                    },
                    {
                        "step_id": 3,
                        "title": "Change passwords for exposed accounts",
                        "description": "If you entered any login details on the fake site, change the password for that account immediately on the real website.",
                        "action_type": "manual"
                    },
                    {
                        "step_id": 4,
                        "title": "Monitor financial accounts",
                        "description": "If you entered payment info, contact your bank to freeze the card or monitor for suspicious charges.",
                        "action_type": "manual"
                    }
                ]
            },
            "general_hack": {
                "id": "general_hack",
                "title": "General 'I've Been Hacked' Response",
                "description": "Universal first steps to take when you suspect a security breach but aren't sure of the source.",
                "severity": "high",
                "steps": [
                    {
                        "step_id": 1,
                        "title": "Secure primary email accounts",
                        "description": "Your email is the master key to everything. Change the password and ensure 2FA is active.",
                        "action_type": "manual"
                    },
                    {
                        "step_id": 2,
                        "title": "Check email forwarding rules",
                        "description": "Look in your email settings to ensure hackers haven't set up rules to forward your incoming emails to them.",
                        "action_type": "manual"
                    },
                    {
                        "step_id": 3,
                        "title": "Lock down financial accounts",
                        "description": "Alert your banks that you might be compromised. Freeze credit if necessary.",
                        "action_type": "manual"
                    },
                    {
                        "step_id": 4,
                        "title": "Run a malware scan",
                        "description": "Check your devices for spyware, trojans, or backdoors.",
                        "action_type": "manual"
                    }
                ]
            }
        }

    def get_guidance(self, threat_type: str, scenario: str = None) -> List[str]:
        """Get AI-powered guidance for a specific threat scenario."""
        if scenario and self.ai_service.client:
            try:
                ai_guidance = self.ai_service.generate_incident_guidance(f"{threat_type}: {scenario}")
                if ai_guidance:
                    return ai_guidance
            except:
                pass
        
        # Fallback to playbook steps if possible
        pb = self.playbooks.get("general_hack")
        if "phish" in threat_type.lower():
            pb = self.playbooks.get("phishing_clicked")
        elif "password" in threat_type.lower():
            pb = self.playbooks.get("compromised_password")
            
        return [step["description"] for step in pb["steps"]]

    def get_all_playbooks(self) -> List[Dict]:
        """Return all available incident playbooks."""
        return list(self.playbooks.values())

    def get_playbook(self, playbook_id: str) -> Optional[Dict]:
        """Get a specific playbook by ID."""
        return self.playbooks.get(playbook_id)

    def create_incident(self, user_id: str, incident_type: str, description: str, db) -> str:
        """Create a new active incident for a user and attach the relevant playbook."""
        # Determine best playbook
        playbook_id = "general_hack"
        if "password" in incident_type.lower() or "leak" in incident_type.lower():
            playbook_id = "compromised_password"
        elif "phish" in incident_type.lower() or "link" in incident_type.lower() or "url" in incident_type.lower():
            playbook_id = "phishing_clicked"

        playbook = self.playbooks[playbook_id]
        
        # Initialize step progress tracking
        steps_progress = [
            {
                "step_id": step["step_id"],
                "completed": False,
                "completed_at": None
            }
            for step in playbook["steps"]
        ]

        incident_doc = {
            "user_id": str(user_id),
            "incident_type": incident_type,
            "description": description,
            "playbook_id": playbook_id,
            "status": "active",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "resolved_at": None,
            "steps_progress": steps_progress
        }

        res = db.active_incidents.insert_one(incident_doc)
        return str(res.inserted_id)

    def get_user_incidents(self, user_id: str, db, status: str = None) -> List[Dict]:
        """Get all incidents for a user, optionally filtered by status."""
        query = {"user_id": str(user_id)}
        if status:
            query["status"] = status
            
        cursor = db.active_incidents.find(query).sort("created_at", -1)
        
        incidents = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            # Inject playbook details so the frontend has them
            pb = self.playbooks.get(doc["playbook_id"])
            if pb:
                doc["playbook"] = pb
            incidents.append(doc)
            
        return incidents

    def update_incident_step(self, incident_id: str, user_id: str, step_id: int, completed: bool, db) -> bool:
        """Update the completion status of a specific step in an active incident."""
        try:
            # First get the current incident
            incident = db.active_incidents.find_one({
                "_id": ObjectId(incident_id), 
                "user_id": str(user_id)
            })
            
            if not incident:
                return False
                
            steps = incident.get("steps_progress", [])
            all_completed_now = True
            
            for s in steps:
                if s["step_id"] == step_id:
                    s["completed"] = completed
                    s["completed_at"] = datetime.utcnow() if completed else None
                
                if not s["completed"]:
                    all_completed_now = False

            update_data = {
                "steps_progress": steps,
                "updated_at": datetime.utcnow()
            }
            
            # If all steps are completed, mark the incident as resolved
            if all_completed_now and incident.get("status") != "resolved":
                update_data["status"] = "resolved"
                update_data["resolved_at"] = datetime.utcnow()
            elif not all_completed_now and incident.get("status") == "resolved":
                # Unresolving
                update_data["status"] = "active"
                update_data["resolved_at"] = None

            db.active_incidents.update_one(
                {"_id": ObjectId(incident_id)},
                {"$set": update_data}
            )
            return True
        except Exception as e:
            print(f"Error updating incident step: {e}")
            return False

    def resolve_incident(self, incident_id: str, user_id: str, db) -> bool:
        """Force resolve an incident regardless of step completion."""
        try:
            res = db.active_incidents.update_one(
                {"_id": ObjectId(incident_id), "user_id": str(user_id)},
                {"$set": {
                    "status": "resolved",
                    "resolved_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }}
            )
            return res.modified_count > 0
        except Exception as e:
            print(f"Error resolving incident: {e}")
            return False
