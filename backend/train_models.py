import os
import sys
import pickle
from sklearn.pipeline import Pipeline
from sklearn.naive_bayes import MultinomialNB

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.message_classifier import MessageClassifier
from models.url_classifier import URLClassifier

def train_message_model():
    print("Training Message Classifier on SMSSpamCollection...")
    data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'sms', 'SMSSpamCollection')
    
    if not os.path.exists(data_path):
        print(f"Error: {data_path} not found.")
        return

    messages = []
    labels = []
    
    with open(data_path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            if '\t' in line:
                label_str, msg = line.split('\t', 1)
                label_str = label_str.strip().lower()
                # Map ham to 0, spam to 1 (suspicious) or 2 (scam)
                # Given our label map {0: "safe", 1: "suspicious", 2: "scam"}
                label = 2 if label_str == 'spam' else 0
                labels.append(label)
                messages.append(msg.strip())
                
    if not messages:
        print("No messages found to train.")
        return
        
    print(f"Loaded {len(messages)} messages. Fitting model...")
    model_path = os.path.join(os.path.dirname(__file__), 'models', 'message_model.pkl')
    
    # Initialize the classifier and train
    msg_clf = MessageClassifier(model_path=model_path)
    msg_clf.train(messages, labels)
    print(f"Message Classifier trained and saved to {model_path}.")

def train_url_model():
    print("Training URL Classifier on synthetic URL dataset...")
    # Since URLClassifier takes raw URLs and extracts 18 specific string-based features,
    # and the provided ARFF dataset contains 30 web-scraped features (not raw URLs),
    # we will use a synthetic dataset containing realistic safe and malicious URLs.
    
    import random
    import string
    
    urls = [
        "https://www.google.com",
        "http://wikipedia.org/wiki/Main_Page",
        "https://github.com/login",
        "http://192.168.1.1/login",
        "http://secure-update-paypal-account.com/login.php",
        "http://amazon.co.uk.security-check.xyz/update",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "http://login.yahoo.com.confirm-account.tk/login",
        "http://www.apple.com",
        "http://netflix.com",
        "http://123.45.67.89/secure/login",
        "http://free-iphone-winner.com/claim",
        "https://bankofamerica.com",
        "https://chase.com",
        "http://update.chase.com.security.ml/verify",
        "https://microsoft.com",
        "http://windows-update-critical.cf/install"
    ]
    # {0: "safe", 1: "suspicious", 2: "malicious"}
    labels = [
        0, 0, 0, 1, 2, 2, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0, 2
    ]
    
    # Generate varied synthetic URLs for robust training
    for _ in range(300):
        # generate safe url
        domain = ''.join(random.choices(string.ascii_lowercase, k=random.randint(5, 15)))
        urls.append(f"https://www.{domain}.com/index.html")
        labels.append(0)
        
        # generate malicious url with suspicious keywords, subdomains, odd extensions
        mal_domain = ''.join(random.choices(string.ascii_lowercase, k=random.randint(10, 20)))
        tlds = ['.tk', '.ml', '.ga', '.cf', '.xyz', '.top']
        tld = random.choice(tlds)
        keyword = random.choice(['secure', 'account', 'update', 'login', 'paypal', 'amazon'])
        urls.append(f"http://{keyword}-{mal_domain}{tld}/security/verify.php?client=1234&id=999")
        labels.append(2)
        
        # generate suspicious IP-based URL
        ip = f"{random.randint(1, 255)}.{random.randint(1, 255)}.{random.randint(1, 255)}.{random.randint(1, 255)}"
        urls.append(f"http://{ip}/login")
        labels.append(1)

    print(f"Generated {len(urls)} URLs. Fitting model...")
    model_path = os.path.join(os.path.dirname(__file__), 'models', 'url_model.pkl')
    
    url_clf = URLClassifier(model_path=model_path)
    url_clf.train(urls, labels)
    print(f"URL Classifier trained and saved to {model_path}.")

if __name__ == '__main__':
    train_message_model()
    train_url_model()
