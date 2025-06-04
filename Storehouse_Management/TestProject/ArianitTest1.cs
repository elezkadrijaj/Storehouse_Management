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
    public class SupplierManagementTestsNoExpectedConditions
    {
        private IWebDriver driver = null!;
        private WebDriverWait wait = null!;
        private string baseUrl = "http://localhost:5173/";
        private string supplierManagementPageUrl = "app/supplier";
        private string usernameForTest = "Edi";
        private string passwordForTest = "Edi@123";

        private By createSupplierButton = By.XPath("//button[contains(@class, 'btn-success') and .//i[contains(@class, 'bi-plus-lg')]] | //button[normalize-space()='Create Supplier']");
        private By modalFormSupplierNameInput = By.XPath("//div[contains(@class,'modal-body')]//input[@name='name']");
        private By modalFormContactInfoInput = By.XPath("//div[contains(@class,'modal-body')]//textarea[@name='contactInfo']");
        private By modalSubmitButton = By.XPath("//div[contains(@class,'modal-footer')]//button[@type='submit' and (normalize-space()='Create' or normalize-space()='Update')]");
        private By modalCloseButton = By.XPath("//div[contains(@class,'modal-footer')]//button[normalize-space()='Cancel'] | //div[contains(@class,'modal-header')]//button[contains(@class,'btn-close')]");
        private By modalTitleCreate = By.XPath("//div[contains(@class,'modal-title') and normalize-space()='Create New Supplier']");
        private By modalTitleEdit = By.XPath("//div[contains(@class,'modal-title') and normalize-space()='Edit Supplier']");
        private By modalTitleDelete = By.XPath("//div[contains(@class,'modal-title') and normalize-space()='Confirm Deletion']");

        [SetUp]
        public void Setup()
        {
            driver = new ChromeDriver();
            driver.Manage().Window.Maximize();
            wait = new WebDriverWait(driver, TimeSpan.FromSeconds(20));
            PerformLogin();
            NavigateToSupplierManagementPage();
        }

        private void PerformLogin()
        {
            driver.Navigate().GoToUrl(baseUrl + "login");
            WaitForElementVisible(By.Id("username")).SendKeys(usernameForTest);
            driver.FindElement(By.Id("password")).SendKeys(passwordForTest);
            driver.FindElement(By.CssSelector("button[type='submit']")).Click();
            wait.Until(d => d.Url.Contains("/dashboard") || d.Url.Contains(supplierManagementPageUrl));
        }

        private void NavigateToSupplierManagementPage()
        {
            string targetUrl = baseUrl + supplierManagementPageUrl;
            if (!driver.Url.EndsWith(supplierManagementPageUrl.TrimStart('/')))
            {
                driver.Navigate().GoToUrl(targetUrl);
            }
            WaitForElementVisible(createSupplierButton);
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

        private string GenerateUniqueName(string baseName = "Supplier")
        {
            return $"{baseName} {DateTime.Now:HHmmssfff}";
        }

        [Test, Order(1)]
        public void TC001_ShouldCreateNewSupplier()
        {
            string supplierName = GenerateUniqueName();
            string contactInfo = $"Contact for {supplierName}\nPhone: 123-456-7890";
            WaitForElementClickable(createSupplierButton).Click();
            WaitForElementVisible(modalTitleCreate);
            WaitForElementVisible(modalFormSupplierNameInput).SendKeys(supplierName);
            driver.FindElement(modalFormContactInfoInput).SendKeys(contactInfo);
            driver.FindElement(modalSubmitButton).Click();
            WaitForElementVisible(By.XPath("//*[contains(@class, 'Toastify__toast--success') or contains(@class, 'toast-success')]"));
            Assert.IsTrue(driver.PageSource.Contains("Supplier created successfully!"), "Mesazhi i suksesit për krijim nuk u shfaq.");
            WaitForElementToDisappear(modalTitleCreate);
            Assert.IsTrue(IsSupplierInList(supplierName), $"Furnitori i ri '{supplierName}' nuk u gjet në listë.");
        }

        [Test, Order(2)]
        public void TC002_ShouldEditExistingSupplier()
        {
            string initialName = GenerateUniqueName("ToEditSup");
            string initialContact = "Initial Contact";
            CreateSupplierViaUI(initialName, initialContact);
            string updatedName = initialName + " - Updated";
            string updatedContact = "Updated Contact Info";
            IWebElement supplierCard = FindSupplierCard(initialName);
            Assert.IsNotNull(supplierCard, $"Furnitori '{initialName}' nuk u gjet për editim.");
            IWebElement editButton = supplierCard.FindElement(By.XPath(".//button[contains(@class, 'btn-outline-warning') and .//i[contains(@class, 'bi-pencil-fill')]]"));
            wait.Until(d => { try { return editButton.Displayed && editButton.Enabled; } catch (StaleElementReferenceException) { return false; } catch (NoSuchElementException) { return false; } });
            editButton.Click();
            WaitForElementVisible(modalTitleEdit);
            IWebElement nameInput = WaitForElementVisible(modalFormSupplierNameInput);
            IWebElement contactInput = driver.FindElement(modalFormContactInfoInput);
            nameInput.Clear();
            nameInput.SendKeys(updatedName);
            contactInput.Clear();
            contactInput.SendKeys(updatedContact);
            driver.FindElement(modalSubmitButton).Click();
            WaitForElementVisible(By.XPath("//*[contains(@class, 'Toastify__toast--success') or contains(@class, 'toast-success')]"));
            Assert.IsTrue(driver.PageSource.Contains("Supplier updated successfully!"), "Mesazhi i suksesit për përditësim nuk u shfaq.");
            WaitForElementToDisappear(modalTitleEdit);
            Assert.IsFalse(IsSupplierInList(initialName, 5), $"Emri i vjetër '{initialName}' ende gjendet pas editimit.");
            Assert.IsTrue(IsSupplierInList(updatedName), $"Emri i ri '{updatedName}' nuk u gjet pas editimit.");
        }

        [Test, Order(3)]
        public void TC003_ShouldDeleteExistingSupplier()
        {
            string nameToDelete = GenerateUniqueName("ToDeleteSup");
            CreateSupplierViaUI(nameToDelete, "Contact to Delete");
            IWebElement supplierCard = FindSupplierCard(nameToDelete);
            Assert.IsNotNull(supplierCard, $"Furnitori '{nameToDelete}' nuk u gjet për fshirje.");
            IWebElement deleteButtonOnCard = supplierCard.FindElement(By.XPath(".//button[contains(@class, 'btn-outline-danger') and .//i[contains(@class, 'bi-trash3-fill')]]"));
            wait.Until(d => { try { return deleteButtonOnCard.Displayed && deleteButtonOnCard.Enabled; } catch (StaleElementReferenceException) { return false; } catch (NoSuchElementException) { return false; } });
            deleteButtonOnCard.Click();
            WaitForElementVisible(modalTitleDelete);
            IWebElement confirmDeleteModalButton = WaitForElementClickable(By.XPath("//div[contains(@class,'modal-footer')]//button[normalize-space()='Delete' and contains(@class,'btn-danger')]"));
            confirmDeleteModalButton.Click();
            WaitForElementVisible(By.XPath("//*[contains(@class, 'Toastify__toast--success') or contains(@class, 'toast-success')]"));
            Assert.IsTrue(driver.PageSource.Contains("deleted successfully!"), "Mesazhi i suksesit për fshirje nuk u shfaq.");
            WaitForElementToDisappear(modalTitleDelete);
            Assert.IsFalse(IsSupplierInList(nameToDelete, 5), $"Furnitori '{nameToDelete}' ende gjendet pas fshirjes.");
        }

        private void CreateSupplierViaUI(string name, string contactInfo)
        {
            if (!driver.Url.EndsWith(supplierManagementPageUrl.TrimStart('/')))
            {
                NavigateToSupplierManagementPage();
            }
            WaitForElementClickable(createSupplierButton).Click();
            WaitForElementVisible(modalTitleCreate);
            WaitForElementVisible(modalFormSupplierNameInput).SendKeys(name);
            driver.FindElement(modalFormContactInfoInput).SendKeys(contactInfo);
            driver.FindElement(modalSubmitButton).Click();
            WaitForElementToDisappear(modalTitleCreate);
            Thread.Sleep(1500);
        }

        private bool IsSupplierInList(string name, int timeoutInSeconds = 10)
        {
            By supplierTitleSelector = By.XPath($"//div[contains(@class, 'card-body')]//div[contains(@class, 'card-title') and normalize-space()='{name}']");
            try
            {
                WaitForElementVisible(supplierTitleSelector, timeoutInSeconds);
                return true;
            }
            catch (WebDriverTimeoutException)
            {
                return false;
            }
        }

        private IWebElement? FindSupplierCard(string name)
        {
            By supplierTitleSelector = By.XPath($"//div[contains(@class, 'card-body')]//div[contains(@class, 'card-title') and normalize-space()='{name}']");
            try
            {
                IWebElement titleElement = WaitForElementVisible(supplierTitleSelector);
                return titleElement.FindElement(By.XPath("./ancestor::div[contains(@class, 'card')][1]"));
            }
            catch (WebDriverTimeoutException)
            {
                Console.WriteLine($"DEBUG: Furnitori '{name}' nuk u gjet në DOM (FindSupplierCard).");
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