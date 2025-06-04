using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;
using System;
using System.Linq;
using System.Threading;

namespace StorehouseManagement.UITests
{
    [TestFixture]
    public class AllWorkersManagementNoExpectedCondTests
    {
        private IWebDriver driver = null!;
        private WebDriverWait wait = null!;
        private string baseUrl = "http://localhost:5173/";
        private string allWorkersPageUrl = "app/all-workers";
        private string companyManagerUsername = "Edi";
        private string companyManagerPassword = "Edi@123";

        private By registerNewWorkerButton = By.XPath("//button[normalize-space()='Register New Worker']");
        private By registerWorkerModalTitle = By.XPath("//div[contains(@class,'modal-title') and normalize-space()='Register New Worker']");
        private By registerUsernameInput = By.Id("registerUsername");
        private By registerEmailInput = By.Id("registerEmail");
        private By registerPasswordInput = By.Id("registerPassword");
        private By registerStorehouseNameInput = By.Id("registerStorehouseName");
        private By registerWorkerModalSubmitButton = By.XPath("//div[contains(@class,'modal-body')]//button[@type='submit' and normalize-space()='Register Worker']");

        private string assignRoleModalTitlePartialText = "Assign Role to:";
        private string updateRoleModalTitlePartialText = "Update Role for:";
        private By assignRoleSelectDropdown = By.Id("assignRoleSelectModal");
        private By assignRoleModalSubmitButton = By.XPath("//div[contains(@class,'modal-body')]//button[@type='submit' and (contains(normalize-space(),'Assign Role') or contains(normalize-space(),'Update Role'))]");
        private By assignRoleModalCloseButton = By.XPath("//div[contains(@class,'modal-footer')]//button[normalize-space()='Close'] | //div[contains(@class,'modal-header')]//button[contains(@class,'btn-close')]");
        private By registerWorkerModalCloseButton = By.XPath("//div[contains(@class,'modal-footer')]//button[normalize-space()='Close'] | //div[contains(@class,'modal-header')]//button[contains(@class,'btn-close')]");


        [SetUp]
        public void Setup()
        {
            driver = new ChromeDriver();
            driver.Manage().Window.Maximize();
            wait = new WebDriverWait(driver, TimeSpan.FromSeconds(25));
            PerformCompanyManagerLogin();
            NavigateToAllWorkersPage();
        }

        private void PerformCompanyManagerLogin()
        {
            driver.Navigate().GoToUrl(baseUrl + "login");
            WaitForElementVisible(By.Id("username")).SendKeys(companyManagerUsername);
            driver.FindElement(By.Id("password")).SendKeys(companyManagerPassword);
            driver.FindElement(By.CssSelector("button[type='submit']")).Click();
            wait.Until(d => d.Url.Contains("/dashboard") || d.Url.Contains(allWorkersPageUrl) || d.Url.Contains("/app/"));
        }

        private void NavigateToAllWorkersPage()
        {
            string targetUrl = baseUrl + allWorkersPageUrl;
            if (!driver.Url.EndsWith(allWorkersPageUrl.TrimStart('/')))
            {
                driver.Navigate().GoToUrl(targetUrl);
            }
            WaitForElementVisible(registerNewWorkerButton);
        }

        private IWebElement WaitForElementVisible(By locator, int? timeoutSeconds = null)
        {
            var customWait = timeoutSeconds.HasValue ? new WebDriverWait(driver, TimeSpan.FromSeconds(timeoutSeconds.Value)) : wait;
            return customWait.Until(d =>
            {
                try { var element = d.FindElement(locator); return element.Displayed ? element : null; }
                catch (NoSuchElementException) { return null; }
                catch (StaleElementReferenceException) { return null; }
            });
        }

        private IWebElement WaitForElementClickable(By locator, int? timeoutSeconds = null)
        {
            var customWait = timeoutSeconds.HasValue ? new WebDriverWait(driver, TimeSpan.FromSeconds(timeoutSeconds.Value)) : wait;
            return customWait.Until(d =>
            {
                try { var element = d.FindElement(locator); return (element.Displayed && element.Enabled) ? element : null; }
                catch (NoSuchElementException) { return null; }
                catch (StaleElementReferenceException) { return null; }
            });
        }
        private void WaitForElementToDisappear(By locator, int? timeoutSeconds = null)
        {
            var customWait = timeoutSeconds.HasValue ? new WebDriverWait(driver, TimeSpan.FromSeconds(timeoutSeconds.Value)) : wait;
            customWait.Until(d =>
            {
                try { return !d.FindElements(locator).Any(el => el.Displayed); }
                catch (StaleElementReferenceException) { return true; }
            });
        }

        private string GenerateUniqueUsername(string baseName = "worker")
        {
            return $"{baseName}{DateTime.Now:HHmmssfff}";
        }
        private string GenerateUniqueEmail(string username)
        {
            return $"{username}@testdomain.com";
        }

        [Test, Order(1)]
        public void TC001_CompanyManagerShouldBeAbleToRegisterNewWorker()
        {
            string workerUsername = GenerateUniqueUsername();
            string workerEmail = GenerateUniqueEmail(workerUsername);
            string workerPassword = "WorkerPassword123!";
            string storehouseNameForWorker = "Liridona Depo 2";

            WaitForElementClickable(registerNewWorkerButton).Click();
            WaitForElementVisible(registerWorkerModalTitle);
            WaitForElementVisible(registerUsernameInput).SendKeys(workerUsername);
            driver.FindElement(registerEmailInput).SendKeys(workerEmail);
            driver.FindElement(registerPasswordInput).SendKeys(workerPassword);
            driver.FindElement(registerStorehouseNameInput).SendKeys(storehouseNameForWorker);
            WaitForElementClickable(registerWorkerModalSubmitButton).Click();

            WaitForElementVisible(By.XPath("//*[contains(@class, 'toastify-content') and contains(@class, 'bg-success')] | //*[contains(@class, 'Toastify__toast--success')] | //div[contains(@class,'alert-success')]"));
            Assert.IsTrue(driver.PageSource.Contains("Worker registered successfully!") || driver.PageSource.Contains("Worker account created successfully."),
                "Mesazhi i suksesit për regjistrimin e punëtorit nuk u shfaq.");

            try
            {
                if (driver.FindElement(registerWorkerModalTitle).Displayed)
                {
                    WaitForElementClickable(registerWorkerModalCloseButton).Click();
                    WaitForElementToDisappear(registerWorkerModalTitle, 5);
                }
            }
            catch (NoSuchElementException) { }

            Thread.Sleep(1000);

            Assert.IsTrue(IsWorkerInTable(workerUsername), $"Punëtori i ri '{workerUsername}' nuk u gjet në tabelë.");
        }

       
       
        private bool IsWorkerInTable(string username)
        {
            try
            {
                WaitForElementVisible(By.XPath($"//table[contains(@class,'table')]//tbody//tr//td[2][normalize-space()='{username}']"), 10);
                return true;
            }
            catch (WebDriverTimeoutException)
            {
                return false;
            }
        }

        

        [TearDown]
        public void TearDown()
        {
            if (driver != null)
            {
                try { driver.Quit(); }
                catch { }
                finally { driver.Dispose(); }
            }
        }
    }
}