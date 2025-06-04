using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;
using System;
using System.Linq;
using System.Threading;
using System.Globalization; // Për konvertime numrash

namespace StorehouseManagement.UITests
{
    [TestFixture]
    public class StorehouseManagementTests
    {
        private IWebDriver driver = null!;
        private WebDriverWait wait = null!;
        private string baseUrl = "http://localhost:5173/"; 
        private string storehouseManagementPageUrl = "app/my-storehouses";
        private string usernameForTest = "Edi"; 
        private string passwordForTest = "Edi@123"; 

        
        private By createStorehouseButton = By.XPath("//button[normalize-space()='Create Storehouse' and contains(@class, 'btn-success')]");

        
        private By modalTitle = By.ClassName("modal-title"); 
        private By storehouseNameInput = By.Id("createStorehouseName"); 
        private By locationInput = By.Id("createLocation");         
        private By sizeInput = By.Id("createSize");                 
        private By modalSubmitButton = By.XPath("//div[contains(@class,'modal-footer')]//button[@type='submit' and (contains(@class, 'btn-primary') or contains(@class, 'btn-warning'))]"); // Mbulon Create dhe Update

        private string storehouseCardXPathByName(string name) =>
            $"//div[contains(@class, 'card-body')][.//div[contains(@class, 'card-title') and normalize-space()='{name}']]";


        [SetUp]
        public void Setup()
        {
            driver = new ChromeDriver();
            driver.Manage().Window.Maximize();

            Thread.CurrentThread.CurrentCulture = CultureInfo.InvariantCulture;
            Thread.CurrentThread.CurrentUICulture = CultureInfo.InvariantCulture;
            wait = new WebDriverWait(driver, TimeSpan.FromSeconds(25)); 

            PerformLogin();
            NavigateToStorehouseManagementPage();
        }

        private void PerformLogin()
        {
            driver.Navigate().GoToUrl(baseUrl + "login"); 
            WaitForElementVisible(By.Id("username")).SendKeys(usernameForTest);
            driver.FindElement(By.Id("password")).SendKeys(passwordForTest);
            driver.FindElement(By.CssSelector("button[type='submit']")).Click();
            wait.Until(d => d.Url.Contains("/dashboard") || d.Url.Contains(storehouseManagementPageUrl) || d.Url.Contains("/app/storehouse"));
        }

        private void NavigateToStorehouseManagementPage()
        {
            string targetUrl = baseUrl + storehouseManagementPageUrl;
            if (!driver.Url.EndsWith(storehouseManagementPageUrl.TrimStart('/')))
            {
                driver.Navigate().GoToUrl(targetUrl);
            }
            WaitForElementVisible(createStorehouseButton);
        }

        private IWebElement WaitForElementVisible(By locator, int? timeoutSeconds = null)
        {
            var customWait = timeoutSeconds.HasValue ? new WebDriverWait(driver, TimeSpan.FromSeconds(timeoutSeconds.Value)) : wait;
            return customWait.Until(d =>
            {
                try
                {
                    var element = d.FindElement(locator);
                    return element.Displayed ? element : null;
                }
                catch (NoSuchElementException) { return null; }
                catch (StaleElementReferenceException) { return null; }
            });
        }

        private IWebElement WaitForElementClickable(By locator, int? timeoutSeconds = null)
        {
            var customWait = timeoutSeconds.HasValue ? new WebDriverWait(driver, TimeSpan.FromSeconds(timeoutSeconds.Value)) : wait;
            return customWait.Until(d =>
            {
                try
                {
                    var element = d.FindElement(locator);
                    return (element.Displayed && element.Enabled) ? element : null;
                }
                catch (NoSuchElementException) { return null; }
                catch (StaleElementReferenceException) { return null; }
            });
        }

        private void WaitForElementToDisappear(By locator, int? timeoutSeconds = null)
        {
            var customWait = timeoutSeconds.HasValue ? new WebDriverWait(driver, TimeSpan.FromSeconds(timeoutSeconds.Value)) : wait;
            customWait.Until(d =>
            {
                try
                {
                    return !d.FindElements(locator).Any(el => el.Displayed);
                }
                catch (StaleElementReferenceException) { return true; }
            });
        }

        private string GenerateUniqueName(string baseName = "Storehouse Test")
        {
            return $"{baseName} {DateTime.Now:HHmmssfff}";
        }

        [Test, Order(1)]
        public void TC001_ShouldCreateNewStorehouse()
        {
            string storehouseName = GenerateUniqueName();
            string location = "Test Location " + new Random().Next(1000);
            string size = new Random().Next(100, 1000).ToString();

            WaitForElementClickable(createStorehouseButton).Click();

            WaitForElementVisible(modalTitle); 
            WaitForElementVisible(storehouseNameInput).SendKeys(storehouseName);
            driver.FindElement(locationInput).SendKeys(location);
            driver.FindElement(sizeInput).SendKeys(size);
            driver.FindElement(modalSubmitButton).Click(); 

            WaitForElementVisible(By.CssSelector(".Toastify__toast--success"));
            Assert.IsTrue(driver.PageSource.Contains("Storehouse created successfully!"), "Mesazhi i suksesit nuk u shfaq.");

            Assert.IsTrue(IsStorehouseInList(storehouseName), $"Depoja e re '{storehouseName}' nuk u gjet në listë.");
        }

        [Test, Order(2)]
        public void TC002_ShouldShowErrorWhenCreatingStorehouseWithEmptyFields()
        {
            WaitForElementClickable(createStorehouseButton).Click();

            WaitForElementVisible(modalTitle);

            driver.FindElement(modalSubmitButton).Click();

            WaitForElementVisible(By.CssSelector(".Toastify__toast--warning"));
            Assert.IsTrue(driver.PageSource.Contains("Please fill in all fields."), "Mesazhi i gabimit për fusha boshe nuk u shfaq.");

            driver.FindElement(By.XPath("//div[contains(@class,'modal-footer')]//button[normalize-space()='Cancel'] | //div[contains(@class,'modal-header')]//button[contains(@class,'btn-close')]")).Click();
            WaitForElementToDisappear(modalTitle);
        }

       
        
        private void CreateStorehouseViaUI(string name, string location, string size)
        {
            if (!driver.Url.EndsWith(storehouseManagementPageUrl.TrimStart('/')))
            {
                NavigateToStorehouseManagementPage();
            }
            WaitForElementClickable(createStorehouseButton).Click();
            WaitForElementVisible(modalTitle);
            WaitForElementVisible(storehouseNameInput).SendKeys(name);
            driver.FindElement(locationInput).SendKeys(location);
            driver.FindElement(sizeInput).SendKeys(size);
            driver.FindElement(modalSubmitButton).Click();
            WaitForElementToDisappear(modalTitle);
            Thread.Sleep(1500); 
        }

        private bool IsStorehouseInList(string name, bool expectPresent = true)
        {
            By storehouseTitleSelector = By.XPath($"//div[contains(@class, 'card-title') and normalize-space()='{name}']");
            try
            {
                if (expectPresent)
                {
                    WaitForElementVisible(storehouseTitleSelector, 10); 
                    return true;
                }
                else
                {
                    WaitForElementToDisappear(storehouseTitleSelector, 5); 
                    return false;
                }
            }
            catch (WebDriverTimeoutException)
            {
                return !expectPresent;
            }
        }

        private IWebElement? FindStorehouseCard(string name)
        {
            try
            {
                IWebElement titleElement = WaitForElementVisible(By.XPath($"//div[contains(@class, 'card-title') and normalize-space()='{name}']"));
                return titleElement.FindElement(By.XPath($"./ancestor::div[contains(@class, 'card') and contains(@class,'h-100')][1]"));
            }
            catch (WebDriverTimeoutException)
            {
                return null;
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