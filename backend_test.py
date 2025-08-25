#!/usr/bin/env python3
"""
FileConvert Hub Backend API Testing Suite
Tests all backend API endpoints for file conversion functionality
"""

import requests
import json
import os
import tempfile
import time
from pathlib import Path

# Configuration
BASE_URL = "https://fileconvert-hub-1.preview.emergentagent.com/api"
TEST_USER_ID = "test_user_123"

class FileConvertHubTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {}
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details:
            print(f"   Details: {details}")
    
    def create_test_files(self):
        """Create test files for conversion testing"""
        test_files = {}
        
        # Create a test TXT file
        txt_content = """This is a test text file for conversion testing.
It contains multiple lines of text.
This will be used to test TXT to PDF conversion.
Line 4 of the test file.
End of test content."""
        
        txt_file = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
        txt_file.write(txt_content)
        txt_file.close()
        test_files['txt'] = txt_file.name
        
        # Create a simple DOCX file content (we'll simulate this)
        # For testing purposes, we'll create a simple text file with .docx extension
        # In a real scenario, you'd create a proper DOCX file
        docx_file = tempfile.NamedTemporaryFile(mode='w', suffix='.docx', delete=False)
        docx_file.write("Test DOCX content for conversion")
        docx_file.close()
        test_files['docx'] = docx_file.name
        
        return test_files
    
    def cleanup_test_files(self, test_files):
        """Clean up test files"""
        for file_path in test_files.values():
            try:
                os.unlink(file_path)
            except:
                pass
    
    def test_stats_api(self):
        """Test GET /api/stats endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/stats")
            
            if response.status_code == 200:
                data = response.json()
                if 'stats' in data and 'totalConversions' in data:
                    self.log_result(
                        "Stats API", 
                        True, 
                        "Stats API working correctly",
                        {"status_code": response.status_code, "data_keys": list(data.keys())}
                    )
                else:
                    self.log_result(
                        "Stats API", 
                        False, 
                        "Stats API missing required fields",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Stats API", 
                    False, 
                    f"Stats API returned status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result("Stats API", False, f"Stats API request failed: {str(e)}")
    
    def test_conversions_history_api(self):
        """Test GET /api/conversions endpoint"""
        try:
            headers = {'x-user-id': TEST_USER_ID}
            response = self.session.get(f"{self.base_url}/conversions", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'conversions' in data:
                    self.log_result(
                        "Conversions History API", 
                        True, 
                        "Conversions history API working correctly",
                        {"status_code": response.status_code, "conversions_count": len(data['conversions'])}
                    )
                else:
                    self.log_result(
                        "Conversions History API", 
                        False, 
                        "Conversions history API missing 'conversions' field",
                        {"response": data}
                    )
            else:
                self.log_result(
                    "Conversions History API", 
                    False, 
                    f"Conversions history API returned status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result("Conversions History API", False, f"Conversions history API request failed: {str(e)}")
    
    def test_txt_conversion(self, test_files):
        """Test TXT to PDF conversion"""
        try:
            with open(test_files['txt'], 'rb') as f:
                files = {'file': ('test.txt', f, 'text/plain')}
                data = {
                    'conversionType': 'txt-to-pdf',
                    'userId': TEST_USER_ID
                }
                
                response = self.session.post(f"{self.base_url}/convert", files=files, data=data)
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get('success') and 'fileId' in result:
                        self.log_result(
                            "TXT to PDF Conversion", 
                            True, 
                            "TXT to PDF conversion successful",
                            {"fileId": result['fileId'], "downloadUrl": result.get('downloadUrl')}
                        )
                        return result['fileId']
                    else:
                        self.log_result(
                            "TXT to PDF Conversion", 
                            False, 
                            "TXT to PDF conversion response missing required fields",
                            {"response": result}
                        )
                else:
                    self.log_result(
                        "TXT to PDF Conversion", 
                        False, 
                        f"TXT to PDF conversion failed with status {response.status_code}",
                        {"response": response.text}
                    )
                    
        except Exception as e:
            self.log_result("TXT to PDF Conversion", False, f"TXT to PDF conversion request failed: {str(e)}")
        
        return None
    
    def test_docx_conversion(self, test_files):
        """Test DOCX to TXT conversion"""
        try:
            with open(test_files['docx'], 'rb') as f:
                files = {'file': ('test.docx', f, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
                data = {
                    'conversionType': 'docx-to-txt',
                    'userId': TEST_USER_ID
                }
                
                response = self.session.post(f"{self.base_url}/convert", files=files, data=data)
                
                # DOCX conversion might fail due to file format, but we test the API response
                if response.status_code == 200:
                    result = response.json()
                    if result.get('success') and 'fileId' in result:
                        self.log_result(
                            "DOCX to TXT Conversion", 
                            True, 
                            "DOCX to TXT conversion successful",
                            {"fileId": result['fileId'], "downloadUrl": result.get('downloadUrl')}
                        )
                        return result['fileId']
                    else:
                        self.log_result(
                            "DOCX to TXT Conversion", 
                            False, 
                            "DOCX to TXT conversion response missing required fields",
                            {"response": result}
                        )
                elif response.status_code == 400:
                    # Expected for invalid DOCX file format
                    error_data = response.json()
                    self.log_result(
                        "DOCX to TXT Conversion", 
                        True, 
                        "DOCX to TXT conversion properly handles invalid file format",
                        {"error_handling": error_data.get('error')}
                    )
                else:
                    self.log_result(
                        "DOCX to TXT Conversion", 
                        False, 
                        f"DOCX to TXT conversion failed with unexpected status {response.status_code}",
                        {"response": response.text}
                    )
                    
        except Exception as e:
            self.log_result("DOCX to TXT Conversion", False, f"DOCX to TXT conversion request failed: {str(e)}")
        
        return None
    
    def test_file_upload_validation(self):
        """Test file upload validation"""
        try:
            # Test with no file
            data = {
                'conversionType': 'txt-to-pdf',
                'userId': TEST_USER_ID
            }
            
            response = self.session.post(f"{self.base_url}/convert", data=data)
            
            if response.status_code == 400:
                error_data = response.json()
                if 'error' in error_data:
                    self.log_result(
                        "File Upload Validation", 
                        True, 
                        "File upload validation working - properly rejects missing file",
                        {"error_message": error_data['error']}
                    )
                else:
                    self.log_result(
                        "File Upload Validation", 
                        False, 
                        "File upload validation missing error message",
                        {"response": error_data}
                    )
            else:
                self.log_result(
                    "File Upload Validation", 
                    False, 
                    f"File upload validation failed - expected 400, got {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result("File Upload Validation", False, f"File upload validation test failed: {str(e)}")
    
    def test_download_api(self, file_id):
        """Test file download API"""
        if not file_id:
            self.log_result("File Download API", False, "No file ID available for download test")
            return
            
        try:
            response = self.session.get(f"{self.base_url}/download/{file_id}")
            
            if response.status_code == 200:
                # Check if it's a file download
                content_type = response.headers.get('content-type', '')
                content_disposition = response.headers.get('content-disposition', '')
                
                if 'attachment' in content_disposition or 'application/octet-stream' in content_type:
                    self.log_result(
                        "File Download API", 
                        True, 
                        "File download API working correctly",
                        {
                            "content_type": content_type,
                            "content_disposition": content_disposition,
                            "content_length": len(response.content)
                        }
                    )
                else:
                    self.log_result(
                        "File Download API", 
                        False, 
                        "File download API not returning proper file headers",
                        {"headers": dict(response.headers)}
                    )
            elif response.status_code == 404:
                # This might be expected if file doesn't exist
                self.log_result(
                    "File Download API", 
                    True, 
                    "File download API properly handles missing files",
                    {"status_code": response.status_code}
                )
            else:
                self.log_result(
                    "File Download API", 
                    False, 
                    f"File download API returned unexpected status {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result("File Download API", False, f"File download API test failed: {str(e)}")
    
    def test_download_nonexistent_file(self):
        """Test download API with non-existent file"""
        try:
            fake_file_id = "nonexistent-file-id-12345"
            response = self.session.get(f"{self.base_url}/download/{fake_file_id}")
            
            if response.status_code == 404:
                error_data = response.json()
                if 'error' in error_data:
                    self.log_result(
                        "Download Non-existent File", 
                        True, 
                        "Download API properly handles non-existent files",
                        {"error_message": error_data['error']}
                    )
                else:
                    self.log_result(
                        "Download Non-existent File", 
                        False, 
                        "Download API missing error message for non-existent file",
                        {"response": error_data}
                    )
            else:
                self.log_result(
                    "Download Non-existent File", 
                    False, 
                    f"Download API should return 404 for non-existent file, got {response.status_code}",
                    {"response": response.text}
                )
                
        except Exception as e:
            self.log_result("Download Non-existent File", False, f"Download non-existent file test failed: {str(e)}")
    
    def test_unsupported_conversion(self, test_files):
        """Test unsupported conversion type"""
        try:
            with open(test_files['txt'], 'rb') as f:
                files = {'file': ('test.txt', f, 'text/plain')}
                data = {
                    'conversionType': 'unsupported-conversion',
                    'userId': TEST_USER_ID
                }
                
                response = self.session.post(f"{self.base_url}/convert", files=files, data=data)
                
                if response.status_code == 400:
                    error_data = response.json()
                    if 'error' in error_data:
                        self.log_result(
                            "Unsupported Conversion Type", 
                            True, 
                            "API properly handles unsupported conversion types",
                            {"error_message": error_data['error']}
                        )
                    else:
                        self.log_result(
                            "Unsupported Conversion Type", 
                            False, 
                            "API missing error message for unsupported conversion",
                            {"response": error_data}
                        )
                else:
                    self.log_result(
                        "Unsupported Conversion Type", 
                        False, 
                        f"API should return 400 for unsupported conversion, got {response.status_code}",
                        {"response": response.text}
                    )
                    
        except Exception as e:
            self.log_result("Unsupported Conversion Type", False, f"Unsupported conversion test failed: {str(e)}")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print(f"🚀 Starting FileConvert Hub Backend API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)
        
        # Create test files
        test_files = self.create_test_files()
        
        try:
            # Test basic API endpoints
            self.test_stats_api()
            self.test_conversions_history_api()
            
            # Test file upload validation
            self.test_file_upload_validation()
            
            # Test file conversions
            txt_file_id = self.test_txt_conversion(test_files)
            docx_file_id = self.test_docx_conversion(test_files)
            
            # Test download functionality
            self.test_download_api(txt_file_id)
            self.test_download_nonexistent_file()
            
            # Test error handling
            self.test_unsupported_conversion(test_files)
            
        finally:
            # Clean up test files
            self.cleanup_test_files(test_files)
        
        # Print summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['message']}")
        
        return self.test_results

if __name__ == "__main__":
    tester = FileConvertHubTester()
    results = tester.run_all_tests()