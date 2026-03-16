from typing import Dict, Any, List
from datetime import datetime, timedelta
import numpy as np

class RiskService:
    """Service for calculating personal cyber safety scores with cross-platform consistency."""
    
    def __init__(self):
        # Weight factors for different risk components
        self.weights = {
            "breach_risk": 0.3,
            "malicious_urls": 0.25,
            "suspicious_messages": 0.25,
            "password_risk": 0.2
        }
    
    def calculate_risk_score(self, user_id: int, db) -> Dict[str, Any]:
        """Calculate the overall risk score for a user with cross-platform consistency."""
        # Get user scan history from all platforms
        scan_history = self._get_user_scan_history(user_id, db)
        
        # Calculate individual risk factors
        breach_risk = self._calculate_breach_risk(user_id, db)
        url_risk = self._calculate_url_risk(scan_history)
        message_risk = self._calculate_message_risk(scan_history)
        password_risk = self._calculate_password_risk(scan_history)
        
        # Calculate weighted score (0-100 scale)
        risk_score = (
            breach_risk * self.weights["breach_risk"] +
            url_risk * self.weights["malicious_urls"] +
            message_risk * self.weights["suspicious_messages"] +
            password_risk * self.weights["password_risk"]
        ) * 100
        
        # Determine status based on score
        status = self._determine_status(risk_score)
        
        # Get platform-specific insights
        platform_insights = self._get_platform_insights(scan_history)
        
        return {
            "score": round(risk_score, 2),
            "status": status,
            "last_updated": datetime.now().isoformat(),
            "factors": {
                "breach_risk": {
                    "score": breach_risk,
                    "weight": self.weights["breach_risk"]
                },
                "malicious_urls": {
                    "score": url_risk,
                    "weight": self.weights["malicious_urls"]
                },
                "suspicious_messages": {
                    "score": message_risk,
                    "weight": self.weights["suspicious_messages"]
                },
                "password_risk": {
                    "score": password_risk,
                    "weight": self.weights["password_risk"]
                }
            },
            "platform_insights": platform_insights,
            "recommendations": self._generate_recommendations(
                breach_risk, url_risk, message_risk, password_risk
            )
        }
    
    def _get_user_scan_history(self, user_id, db) -> List[Dict]:
        """Get user's scan history from all platforms."""
        # Note: db is now a database object from PyMongo
        cursor = db.scan_history.find(
            {"user_id": str(user_id)}, 
            {"_id": 0, "scan_type": 1, "result": 1, "timestamp": 1}
        ).sort("timestamp", -1)
        
        return list(cursor)
    
    def _calculate_breach_risk(self, user_id, db) -> float:
        """Calculate breach risk factor based on total leak count across all email scans."""
        scans = db.scan_history.find({
            "user_id": str(user_id),
            "scan_type": "email"
        })
        
        total_breaches = 0
        for scan in scans:
            result = scan.get('result', {})
            total_breaches += result.get('breach_count', 0)
        
        # Normalize: 0 breaches = 0, 5+ breaches = 1.0 (Critical)
        return min(total_breaches / 5.0, 1.0)
    
    def _calculate_url_risk(self, scan_history: List[Dict]) -> float:
        """Calculate URL risk factor based on severity of detections."""
        url_scans = [scan for scan in scan_history if scan['scan_type'] == 'url']
        
        if not url_scans:
            return 0.0
        
        risk_sum = 0
        for scan in url_scans:
            result = scan.get('result', {})
            pred = result.get('prediction', 'safe')
            if pred == 'malicious':
                risk_sum += 1.0
            elif pred == 'suspicious':
                risk_sum += 0.5
            elif pred == 'scam':
                risk_sum += 0.8
        
        # Max out risk if we see 2 malicious or 4 suspicious URLs
        return min(risk_sum / 2.0, 1.0)
    
    def _calculate_message_risk(self, scan_history: List[Dict]) -> float:
        """Calculate message risk factor based on severity of detections."""
        message_scans = [scan for scan in scan_history if scan['scan_type'] == 'message']
        
        if not message_scans:
            return 0.0
        
        risk_sum = 0
        for scan in message_scans:
            result = scan.get('result', {})
            pred = result.get('prediction', 'safe')
            if pred == 'scam':
                risk_sum += 1.0
            elif pred == 'suspicious':
                risk_sum += 0.5
        
        # Max out risk if we see 2 scams or 4 suspicious messages
        return min(risk_sum / 2.0, 1.0)
    
    def _calculate_password_risk(self, scan_history: List[Dict]) -> float:
        """Calculate password risk factor based on compromised count."""
        password_scans = [scan for scan in scan_history if scan['scan_type'] == 'password']
        
        if not password_scans:
            return 0.0
        
        max_compromise = 0
        for scan in password_scans:
            result = scan.get('result', {})
            if result.get('safety_status') == 'compromised':
                # Higher count = higher risk
                count = result.get('compromised_count', 0)
                risk = 1.0 if count > 1000 else 0.5
                max_compromise = max(max_compromise, risk)
        
        return float(max_compromise)
    
    def _determine_status(self, risk_score: float) -> str:
        """Determine risk status based on score."""
        if risk_score < 30:
            return "green"
        elif risk_score < 70:
            return "yellow"
        else:
            return "red"
    
    def _get_platform_insights(self, scan_history: List[Dict]) -> Dict[str, Any]:
        """Get insights by platform for cross-platform consistency."""
        platforms = {
            "web": {"scans": 0, "risks": 0.0},
            "browser_extension": {"scans": 0, "risks": 0.0}
        }
        
        # In a real implementation, you would track platform information
        # For now, we'll distribute scans evenly as an example
        total_scans = len(scan_history)
        if total_scans > 0:
            scans_per_platform = total_scans // 2
            remainder = total_scans % 2
            
            platforms["web"]["scans"] = scans_per_platform + (1 if remainder > 0 else 0)
            platforms["browser_extension"]["scans"] = scans_per_platform
            
            # Calculate risk distribution (simplified)
            risk_per_platform = 1.0 / 2  # Even distribution for demo
            platforms["web"]["risks"] = risk_per_platform
            platforms["browser_extension"]["risks"] = risk_per_platform
        
        return platforms
    
    def _generate_recommendations(self, breach_risk: float, url_risk: float, 
                                message_risk: float, password_risk: float) -> List[str]:
        """Generate personalized recommendations based on risk factors."""
        recommendations = []
        
        if breach_risk > 0.5:
            recommendations.append("Review your accounts for data breaches and change passwords")
        
        if url_risk > 0.5:
            recommendations.append("Be cautious when clicking links, especially in emails or messages")
        
        if message_risk > 0.5:
            recommendations.append("Enable scam detection on all messaging platforms")
        
        if password_risk > 0.5:
            recommendations.append("Use a password manager and enable two-factor authentication")
        
        if not recommendations:
            recommendations.append("Continue practicing good cybersecurity habits")
            recommendations.append("Regularly update your security knowledge")
        
        return recommendations