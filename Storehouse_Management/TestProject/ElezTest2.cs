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
    public class CategoryCreateUpdateTestsNoExpectedConditions
    {
        private IWebDriver driver = null!;
        private WebDriverWait wait = null!;
        private string baseUrl = "http://localhost:5173/"; 
        private string categoryManagementPageUrl = "app/category"; 
        private string usernameForTest = "Edi"; 
        private string passwordForTest = "Edi@123"; 

        
        private By createCategoryButton = By.XPath("//button[contains(@class, 'btn-success') and .//i[contains(@class, 'bi-plus-lg')]] | //button[normalize-space()='Create Category']");
        private By modalFormCategoryNameInput = By.XPath("//div[contains(@class,'modal-body')]//input[@placeholder='Enter category name']");
        private By modalSubmitButton = By.XPath("//div[contains(@class,'modal-footer')]//button[@type='submit' and (normalize-space()='Create' or normalize-space()='Update')]");
        private By modalCloseButton = By.XPath("//div[contains(@class,'modal-footer')]//button[normalize-space()='Cancel'] | //div[contains(@class,'modal-header')]//button[contains(@class,'btn-close')]");
        private By modalTitleCreate = By.XPath("//div[contains(@class,'modal-title') and normalize-space()='Create New Category']");
        private By modalTitleEdit = By.XPath("//div[contains(@class,'modal-title') and normalize-space()='Edit Category']");


        [SetUp]
        public void Setup()
        {
            driver = new ChromeDriver();
            driver.Manage().Window.Maximize();
            wait = new WebDriverWait(driver, TimeSpan.FromSeconds(20));

            PerformLogin();
            NavigateToCategoryManagementPage();
        }

        private void PerformLogin()
        {
            driver.Navigate().GoToUrl(baseUrl + "login");
            WaitForElementVisible(By.Id("username")).SendKeys(usernameForTest);
            driver.FindElement(By.Id("password")).SendKeys(passwordForTest);
            driver.FindElement(By.CssSelector("button[type='submit']")).Click();
            wait.Until(d => d.Url.Contains("/dashboard") || d.Url.Contains(categoryManagementPageUrl));
        }

        private void NavigateToCategoryManagementPage()
        {
            string targetUrl = baseUrl + categoryManagementPageUrl;
            if (!driver.Url.EndsWith(categoryManagementPageUrl.TrimStart('/')))
            {
                driver.Navigate().GoToUrl(targetUrl);
            }
            WaitForElementVisible(createCategoryButton);
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
        
        private string GenerateUniqueCategoryName(string baseName = "Test Category")
        {
            return $"{baseName} {DateTime.Now:HHmmssfff}";
        }

        [Test, Order(1)]
        public void TC001_ShouldAllowCreatingNewCategory()
        {
            string categoryName = GenerateUniqueCategoryName();

            WaitForElementClickable(createCategoryButton).Click();

            WaitForElementVisible(modalTitleCreate); 
            IWebElement nameInput = WaitForElementVisible(modalFormCategoryNameInput);
            nameInput.SendKeys(categoryName);
            driver.FindElement(modalSubmitButton).Click();

            WaitForElementVisible(By.XPath("//*[contains(@class, 'Toastify__toast--success') or contains(@class, 'toast-success')]"));
            Assert.IsTrue(driver.PageSource.Contains("Category created successfully!"), "Mesazhi i suksesit nuk u shfaq ose kategoria nuk u krijua.");

            WaitForElementToDisappear(modalTitleCreate);

            Assert.IsTrue(IsCategoryPresentInList(categoryName), $"Kategoria e re '{categoryName}' nuk u gjet në listë.");
        }


       

       
        private bool IsCategoryPresentInList(string categoryName, int timeoutInSeconds = 10)
        {
            By categoryTitleSelector = By.XPath($"//div[contains(@class, 'card-body')]//div[contains(@class, 'card-title') and normalize-space()='{categoryName}']");
            try
            {
                WaitForElementVisible(categoryTitleSelector, timeoutInSeconds);
                return true;
            }
            catch (WebDriverTimeoutException)
            {
                return false;
            }
        }

        private IWebElement? FindCategoryCard(string categoryName)
        {
            By categoryTitleSelector = By.XPath($"//div[contains(@class, 'card-body')]//div[contains(@class, 'card-title') and normalize-space()='{categoryName}']");
            try
            {
                IWebElement titleElement = WaitForElementVisible(categoryTitleSelector);
                return titleElement.FindElement(By.XPath("./ancestor::div[contains(@class, 'card')][1]"));
            }
            catch (WebDriverTimeoutException)
            {
                Console.WriteLine($"DEBUG: Kategoria '{categoryName}' nuk u gjet në DOM (FindCategoryCard).");
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